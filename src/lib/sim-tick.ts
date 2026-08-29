import type { Sql } from "@/lib/db";
import { recordEvent } from "@/lib/behavior";
import { dimScore, loadMaleDims, stallDims } from "@/lib/dims";
import { loadMaleEcon, scoreWithEcon, wouldBuy, type EconKey } from "@/lib/econ";
import { debitUser, executeBuy, settleUse } from "@/lib/economy";
import { bumpSatiation, lockRental, maybeListFromBoredom, releaseExpiredRentals, unlockRental } from "@/lib/occupancy";
import type { Profile } from "@/lib/profiles";
import { loadSimConfig, simDimWeights, simEconCoeffs, type SimConfig } from "@/lib/sim-config";

const TICK_MALES = 40;
const NOTE_CAP = 16;

export type SimCandidate = {
  id: string;
  score: number;
  hourFen: number;
  listedFen: number | null;
  mine: boolean;
  satiation: number;
  busy: boolean;
  block?: string;
};

export type SimPick =
  | { kind: "use"; stallId: string; reason: "self" | "rent" }
  | { kind: "buy"; stallId: string; reason: "buy" }
  | { kind: "skip"; reason: string };

export type SimTickResult = {
  id: string;
  uses: number;
  selfUses: number;
  buys: number;
  listed: number;
  skipped: number;
  males: number;
  durationMs: number;
  notes: string[];
};

/** 最简决策：自用够分且没厌 → 用自己的；否则租附近最高分；再不行买挂牌。 */
export function pickSimAction(opts: {
  walletFen: number;
  spentToday: number;
  concurrent: number;
  cfg: Pick<
    SimConfig,
    | "useScoreMin"
    | "selfUseScoreMin"
    | "buyScoreMin"
    | "walletStopFen"
    | "maxConcurrentOrders"
    | "dailyBudgetFen"
    | "boredSwitchMin"
  >;
  candidates: SimCandidate[];
  econ?: Record<EconKey, number>;
}): SimPick {
  const { walletFen, spentToday, concurrent, cfg, candidates, econ } = opts;
  if (concurrent >= cfg.maxConcurrentOrders) return { kind: "skip", reason: "concurrent" };

  const own = candidates
    .filter((c) => c.mine && !c.busy && c.score >= cfg.selfUseScoreMin && c.satiation < cfg.boredSwitchMin)
    .sort((a, b) => b.score - a.score);
  if (own[0]) return { kind: "use", stallId: own[0].id, reason: "self" };

  if (walletFen < cfg.walletStopFen) return { kind: "skip", reason: "wallet" };
  if (cfg.dailyBudgetFen > 0 && spentToday >= cfg.dailyBudgetFen) return { kind: "skip", reason: "budget" };

  const rent = candidates
    .filter((c) => !c.mine && !c.busy && !c.block && c.score >= cfg.useScoreMin)
    .sort((a, b) => b.score - a.score);
  if (rent[0]) return { kind: "use", stallId: rent[0].id, reason: "rent" };

  const listed = candidates
    .filter((c) => !c.mine && !c.block && c.listedFen != null && c.listedFen > 0)
    .sort((a, b) => b.score - a.score);
  for (const c of listed) {
    if (
      wouldBuy({
        score: c.score,
        hourFen: c.hourFen,
        listedFen: c.listedFen ?? 0,
        walletFen,
        econ,
        minScore: cfg.buyScoreMin,
      })
    ) {
      return { kind: "buy", stallId: c.id, reason: "buy" };
    }
  }
  const blocked = candidates.find((c) => !c.mine && c.block);
  if (blocked?.block) return { kind: "skip", reason: blocked.block };
  return { kind: "skip", reason: "no-fit" };
}

let running: Promise<SimTickResult> | null = null;

export async function runSimTick(sql: Sql): Promise<SimTickResult> {
  if (running) return running;
  running = tickOnce(sql);
  try {
    return await running;
  } finally {
    running = null;
  }
}

async function tickOnce(sql: Sql): Promise<SimTickResult> {
  const started = Date.now();
  const id = crypto.randomUUID();
  const notes: string[] = [];
  const result: SimTickResult = {
    id,
    uses: 0,
    selfUses: 0,
    buys: 0,
    listed: 0,
    skipped: 0,
    males: 0,
    durationMs: 0,
    notes,
  };

  await sql`
    insert into sim_runs (id, started_at)
    values (${id}, now())
  `;

  try {
    const { ensurePlatform } = await import("@/lib/economy");
    await ensurePlatform(sql);
    await releaseExpiredRentals(sql);
    await import("@/lib/text-scale").then((m) => m.loadTextScale(sql));
    const { syncWorldIfDue } = await import("@/lib/location-sim");
    await syncWorldIfDue();

    const cfg = await loadSimConfig(sql);
    if (cfg.listStaleDays > 0) {
      const stale = await sql<{ id: string }>`
        update stalls
        set listed_fen = null, updated_at = now()
        where listed_fen is not null
          and updated_at < now() - make_interval(days => ${cfg.listStaleDays})
        returning id
      `;
      if (stale.length) note(notes, `撤牌 ${stale.length}（超 ${cfg.listStaleDays} 天）`);
    }
    const males = await loadTickMales(sql, cfg);
    result.males = males.length;

    for (const male of males) {
      const acted = await tickMale(sql, cfg, male, notes);
      if (acted.kind === "self") {
        result.uses += 1;
        result.selfUses += 1;
        if (acted.listed) result.listed += 1;
      } else if (acted.kind === "rent") {
        result.uses += 1;
      } else if (acted.kind === "buy") {
        result.buys += 1;
      } else {
        result.skipped += 1;
      }
    }
  } catch (err) {
    notes.push(err instanceof Error ? err.message : "tick failed");
  }

  result.durationMs = Date.now() - started;
  result.notes = notes.slice(0, NOTE_CAP);
  await sql`
    update sim_runs set
      finished_at = now(),
      uses = ${result.uses},
      self_uses = ${result.selfUses},
      buys = ${result.buys},
      listed = ${result.listed},
      skipped = ${result.skipped},
      males = ${result.males},
      duration_ms = ${result.durationMs},
      notes = ${JSON.stringify(result.notes)}::jsonb
    where id = ${id}
  `;
  return result;
}

type TickMale = { userId: string; lat: number | null; lng: number | null };

async function loadTickMales(sql: Sql, cfg: SimConfig): Promise<TickMale[]> {
  const rows = await sql<{
    user_id: string;
    lat: number | null;
    lng: number | null;
    last_sim: string | null;
  }>`
    select m.user_id, s.lat, s.lng, (
      select max(coalesce(i.updated_at, i.created_at))
      from inquiries i
      where i.user_id = m.user_id and i.slot = 'sim'
    ) as last_sim
    from behavior_male m
    join user_state s on s.user_id = m.user_id
    where m.sim_enabled = true
      and coalesce(s.banned, false) = false
      and coalesce(s.role, 'male') = 'male'
    order by coalesce(s.last_seen_at, s.updated_at) desc nulls last
    limit ${TICK_MALES * 3}
  `;
  const wakeMs = cfg.simTickSec * 1000;
  const out: TickMale[] = [];
  for (const r of rows) {
    if (out.length >= TICK_MALES) break;
    const last = r.last_sim ? Date.parse(r.last_sim) : 0;
    if (last && Date.now() - last < wakeMs) continue;
    out.push({
      userId: r.user_id,
      lat: r.lat == null ? null : Number(r.lat),
      lng: r.lng == null ? null : Number(r.lng),
    });
  }
  return out;
}

async function tickMale(
  sql: Sql,
  cfg: SimConfig,
  male: TickMale,
  notes: string[],
): Promise<{ kind: "self" | "rent" | "buy" | "skip"; listed?: boolean }> {
  const walletRows = await sql<{ fen: number }>`
    select fen from wallets where user_id = ${male.userId} limit 1
  `;
  const walletFen = Number(walletRows[0]?.fen ?? 0);
  const busyRows = await sql<{ n: number }>`
    select count(*)::int as n
    from stalls s
    join inquiries i on i.id = s.busy_inquiry_id
    where i.user_id = ${male.userId} and s.busy_until is not null and s.busy_until > now()
  `;
  const concurrent = Number(busyRows[0]?.n ?? 0);
  const spentRows = await sql<{ n: number }>`
    select coalesce(sum(-fen), 0)::int as n
    from ledger
    where user_id = ${male.userId}
      and kind in ('spend', 'buy')
      and fen < 0
      and created_at >= date_trunc('day', now())
  `;
  const spentToday = Number(spentRows[0]?.n ?? 0);

  const origin = await resolveOrigin(sql, male);
  const { listStallsNear, findStall } = await import("@/lib/stalls");
  const nearby =
    origin != null ? await listStallsNear(sql, origin.lat, origin.lng, cfg.nearbyRadiusM, male.userId) : [];
  const ownedRows = await sql<{ id: string }>`
    select id from stalls where owner_id = ${male.userId} and coalesce(hidden, false) = false
  `;
  const byId = new Map<string, Profile>();
  for (const p of nearby) {
    if (Number(p.age) < 18) continue;
    byId.set(p.id, p);
  }
  for (const row of ownedRows) {
    if (byId.has(row.id)) continue;
    const p = await findStall(sql, row.id, male.userId);
    if (!p || Number(p.age) < 18) continue;
    byId.set(p.id, { ...p, mine: true });
  }

  const [dims, econ] = await Promise.all([loadMaleDims(sql, male.userId), loadMaleEcon(sql, male.userId)]);
  const satRows = await sql<{ stall_id: string; uses: number; value: number }>`
    select stall_id, uses, value from behavior_satiation where male_id = ${male.userId}
  `;
  const satMap = new Map(satRows.map((r) => [r.stall_id, Number(r.value ?? r.uses ?? 0)]));
  const { satiationFromUses } = await import("@/lib/occupancy");
  const weights = simDimWeights(cfg);
  const econCoeffs = simEconCoeffs(cfg);
  const stallIds = [...byId.keys()];
  const usedToday = new Map<string, number>();
  if (cfg.enforceDailyQuota && stallIds.length) {
    const usedRows = await sql.query<{ id: string; n: number }>(
      `select profile_id as id, count(*)::int as n
       from inquiries
       where profile_id = any($1::text[])
         and coalesce(status, 'pending') = 'used'
         and coalesce(updated_at, created_at) >= date_trunc('day', now())
       group by profile_id`,
      [stallIds],
    );
    for (const r of usedRows) usedToday.set(r.id, Number(r.n));
  }
  const myReviews = new Map<string, number>();
  if (cfg.reviewReturnMin > 0 && stallIds.length) {
    const revRows = await sql.query<{ id: string; score: number }>(
      `select profile_id as id, score from reviews
       where user_id = $1 and profile_id = any($2::text[])`,
      [male.userId, stallIds],
    );
    for (const r of revRows) myReviews.set(r.id, Number(r.score));
  }

  const candidates: SimCandidate[] = [];
  for (const p of byId.values()) {
    const stall = stallDims(p);
    const raw = dimScore(dims, stall, p, weights);
    const score = scoreWithEcon(raw, p.hourFen, econ, econCoeffs);
    let block: string | undefined;
    if (!p.mine) {
      if (cfg.condomMatchMin > 0) {
        const maleC = Number(dims.condom ?? 0);
        const stallC = Number(stall.condom ?? 0);
        const match = 1 - Math.abs(maleC - stallC);
        if (match < cfg.condomMatchMin) block = "condom";
      }
      if (!block && cfg.enforceDailyQuota) {
        if (!hoursOpen(p.hoursTag)) block = "hours";
        const cap = quotaCap(p.dailyQuota);
        if (!block && cap != null && (usedToday.get(p.id) ?? 0) >= cap) block = "quota";
      }
      if (!block && cfg.reviewReturnMin > 0) {
        const mine = myReviews.get(p.id);
        if (mine != null && mine < cfg.reviewReturnMin) block = "review";
        else if ((p.ratingCount ?? 0) >= 1 && (p.ratingAvg ?? 0) < cfg.reviewReturnMin) block = "review";
      }
    }
    candidates.push({
      id: p.id,
      score,
      hourFen: p.hourFen,
      listedFen: p.listedFen ?? null,
      mine: Boolean(p.mine),
      satiation: satiationFromUses(satMap.get(p.id) ?? 0, cfg.satiationHalfUses),
      busy: Boolean(p.busy),
      block,
    });
  }

  const pick = pickSimAction({ walletFen, spentToday, concurrent, cfg, candidates, econ });
  if (pick.kind === "skip") {
    note(notes, `${shortId(male.userId)} ${pick.reason}`);
    return { kind: "skip" };
  }

  const stall = byId.get(pick.stallId);
  if (!stall) return { kind: "skip" };

  if (pick.kind === "buy") {
    try {
      await executeBuy(sql, male.userId, stall.id);
      await recordEvent({
        userId: male.userId,
        kind: "buy",
        targetId: stall.id,
        payload: { sim: true },
      });
      note(notes, `${shortId(male.userId)} 买 ${stall.name}`);
      return { kind: "buy" };
    } catch (err) {
      note(notes, `${shortId(male.userId)} 买失败`);
      console.error("[sim-buy]", err);
      return { kind: "skip" };
    }
  }

  const selfUse = pick.reason === "self";
  const inquiryId = crypto.randomUUID();
  const locked = await lockRental(sql, stall.id, inquiryId);
  if (!locked) {
    note(notes, `${shortId(male.userId)} 锁败 ${stall.name}`);
    return { kind: "skip" };
  }
  try {
    await sql`
      insert into inquiries (id, user_id, profile_id, profile_name, slot, note, status)
      values (${inquiryId}, ${male.userId}, ${stall.id}, ${stall.name}, ${"sim"}, ${"模拟"}, ${"used"})
    `;
    if (!selfUse) {
      const stallRow = await sql<{
        owner_id: string | null;
        hour_fen: number;
        base_hour_fen: number | null;
        name: string;
        relation: string | null;
        owned_at: string | null;
      }>`
        select owner_id, hour_fen, base_hour_fen, name, relation, owned_at
        from stalls where id = ${stall.id} limit 1
      `;
      if (!stallRow[0]) throw new Error("没这具");
      const { quoteStallNow } = await import("@/lib/pricing");
      const grossFen = await quoteStallNow(sql, { ...stallRow[0], id: stall.id });
      await debitUser(sql, male.userId, grossFen, inquiryId, `租 ${stall.name}`);
      await settleUse(sql, {
        ownerId: stallRow[0].owner_id,
        grossFen,
        inquiryId,
        stallId: stall.id,
        stallName: stall.name,
        relation: stallRow[0].relation,
        ownedAt: stallRow[0].owned_at,
      });
    }
    await bumpSatiation(sql, male.userId, stall.id, selfUse ? cfg.selfUseSatiation : 1);
    let listedFen: number | null = null;
    if (selfUse) listedFen = await maybeListFromBoredom(sql, male.userId, stall.id);
    await recordEvent({
      userId: male.userId,
      kind: "inquiry_use",
      targetId: stall.id,
      payload: { sim: true, free: selfUse },
    });
    note(notes, `${shortId(male.userId)} ${selfUse ? "自用" : "租"} ${stall.name}`);
    return { kind: selfUse ? "self" : "rent", listed: listedFen != null };
  } catch (err) {
    await unlockRental(sql, inquiryId);
    await sql`
      update inquiries set status = 'cancelled', updated_at = now()
      where id = ${inquiryId} and coalesce(status, 'pending') = 'used'
    `;
    note(notes, `${shortId(male.userId)} 用失败`);
    console.error("[sim-use]", err);
    return { kind: "skip" };
  }
}

async function resolveOrigin(sql: Sql, male: TickMale): Promise<{ lat: number; lng: number } | null> {
  if (male.lat != null && male.lng != null) return { lat: male.lat, lng: male.lng };
  const home = await sql<{ lat: number; lng: number }>`
    select lat, lng from stalls
    where owner_id = ${male.userId} and lat is not null and lng is not null
    limit 1
  `;
  if (home[0]) return { lat: Number(home[0].lat), lng: Number(home[0].lng) };
  return null;
}

function hoursOpen(tag: string | null | undefined, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? at.getHours());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const weekend = weekday === "Sat" || weekday === "Sun";
  if (tag === "仅晚上可接") return hour >= 18 || hour < 6;
  if (tag === "仅白天可接") return hour >= 8 && hour < 18;
  if (tag === "仅周末可接") return weekend;
  if (tag === "仅工作日可接") return !weekend;
  return true;
}

function quotaCap(tag: string | null | undefined) {
  if (tag === "一天一客") return 1;
  if (tag === "一天两客") return 2;
  if (tag === "一天三客") return 3;
  return null;
}

function shortId(id: string) {
  return id.length <= 10 ? id : id.slice(0, 8);
}

function note(notes: string[], line: string) {
  if (notes.length < NOTE_CAP) notes.push(line);
}

export async function enableLocatedMales(sql: Sql) {
  await sql`
    insert into behavior_male (user_id)
    select s.user_id
    from user_state s
    where coalesce(s.role, 'male') = 'male'
      and coalesce(s.banned, false) = false
    on conflict (user_id) do nothing
  `;
  const rows = await sql<{ user_id: string }>`
    update behavior_male m
    set sim_enabled = true, updated_at = now()
    from user_state s
    where s.user_id = m.user_id
      and coalesce(s.banned, false) = false
      and coalesce(s.role, 'male') = 'male'
      and m.sim_enabled = false
      and (
        (s.lat is not null and s.lng is not null)
        or exists (select 1 from stalls st where st.owner_id = m.user_id)
      )
    returning m.user_id
  `;
  return { n: rows.length };
}

export async function latestSimRun(sql: Sql) {
  const rows = await sql<{
    id: string;
    started_at: string;
    finished_at: string | null;
    uses: number;
    self_uses: number;
    buys: number;
    listed: number;
    skipped: number;
    males: number;
    duration_ms: number;
    notes: unknown;
  }>`
    select id, started_at, finished_at, uses, self_uses, buys, listed, skipped, males, duration_ms, notes
    from sim_runs
    order by started_at desc
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    uses: Number(r.uses),
    selfUses: Number(r.self_uses),
    buys: Number(r.buys),
    listed: Number(r.listed),
    skipped: Number(r.skipped),
    males: Number(r.males),
    durationMs: Number(r.duration_ms),
    notes: Array.isArray(r.notes) ? r.notes.map((n) => String(n)) : [],
  };
}
