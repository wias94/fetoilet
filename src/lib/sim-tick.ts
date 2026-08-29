import type { Sql } from "@/lib/db";
import { recordEvent } from "@/lib/behavior";
import { dimScore, loadMaleDims, stallDims } from "@/lib/dims";
import { loadMaleEcon, scoreWithEcon, wouldBuy, type EconKey } from "@/lib/econ";
import { debitUser, executeBuy, settleUse } from "@/lib/economy";
import { bumpSatiation, lockRental, maybeListFromBoredom, releaseExpiredRentals, unlockRental } from "@/lib/occupancy";
import type { Profile } from "@/lib/profiles";
import { loadSimConfig, simDimWeights, simEconCoeffs, type SimConfig } from "@/lib/sim-config";

const NOTE_CAP = 16;
const BUSY_STATUS = new Set(["work", "study", "commuting", "commute"]);

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
    await enableAllMales(sql);

    const cfg = await loadSimConfig(sql);
    const wages = await payDailyWage(sql, cfg.dailyWageFen);
    if (wages) {
      note(notes, `津贴 ${wages} 人`);
      await writeLog(sql, { runId: id, kind: "wage", reason: `${wages}人`, fen: wages * cfg.dailyWageFen });
    }
    if (cfg.listStaleDays > 0) {
      const stale = await sql<{ id: string }>`
        update stalls
        set listed_fen = null, updated_at = now()
        where listed_fen is not null
          and updated_at < now() - make_interval(days => ${cfg.listStaleDays})
        returning id
      `;
      if (stale.length) {
        note(notes, `撤牌 ${stale.length}（超 ${cfg.listStaleDays} 天）`);
        await writeLog(sql, { runId: id, kind: "delist", reason: `${stale.length}具`, name: `超${cfg.listStaleDays}天` });
      }
    }
    const { ready: males, statusSkip } = await loadTickMales(sql, cfg);
    result.males = males.length;
    if (statusSkip) {
      note(notes, `作息跳过 ${statusSkip}`);
      await writeLog(sql, { runId: id, kind: "skip", reason: "status", name: `${statusSkip}人` });
      result.skipped += statusSkip;
    }

    for (const male of males) {
      const acted = await tickMale(sql, cfg, male, notes, id);
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
  try {
    await pruneSimLog(sql);
  } catch {
    /* keep the run even if prune fails */
  }
  return result;
}

type TickMale = { userId: string; lat: number | null; lng: number | null; status: string | null };

async function loadTickMales(sql: Sql, cfg: SimConfig): Promise<{ ready: TickMale[]; statusSkip: number }> {
  const batch = Math.max(5, Math.min(500, cfg.tickBatch));
  const rows = await sql<{
    user_id: string;
    lat: number | null;
    lng: number | null;
    loc_status: string | null;
    last_sim: string | null;
  }>`
    select m.user_id, s.lat, s.lng, s.loc_status, (
      select max(coalesce(i.updated_at, i.created_at))
      from inquiries i
      where i.user_id = m.user_id and i.slot = 'sim'
    ) as last_sim
    from behavior_male m
    join user_state s on s.user_id = m.user_id
    where m.sim_enabled = true
      and m.user_id like 'loc-m-%'
      and coalesce(s.banned, false) = false
      and coalesce(s.role, 'male') = 'male'
    order by last_sim nulls first
    limit ${batch * 6}
  `;
  const wakeMs = cfg.simTickSec * 1000;
  const ready: TickMale[] = [];
  let statusSkip = 0;
  for (const r of rows) {
    if (ready.length >= batch) break;
    const last = r.last_sim ? Date.parse(r.last_sim) : 0;
    if (last && Date.now() - last < wakeMs) continue;
    const status = r.loc_status ? String(r.loc_status) : null;
    if (status && BUSY_STATUS.has(status)) {
      statusSkip += 1;
      continue;
    }
    ready.push({
      userId: r.user_id,
      lat: r.lat == null ? null : Number(r.lat),
      lng: r.lng == null ? null : Number(r.lng),
      status,
    });
  }
  return { ready, statusSkip };
}

async function tickMale(
  sql: Sql,
  cfg: SimConfig,
  male: TickMale,
  notes: string[],
  runId: string,
): Promise<{ kind: "self" | "rent" | "buy" | "skip"; listed?: boolean; fen?: number }> {
  const walletRows = await sql<{ fen: number }>`
    select fen from wallets where user_id = ${male.userId} limit 1
  `;
  const walletFen = Number(walletRows[0]?.fen ?? 0);
  if (male.status && BUSY_STATUS.has(male.status)) {
    note(notes, `${shortId(male.userId)} ${male.status}`);
    await writeLog(sql, { runId, kind: "skip", maleId: male.userId, reason: male.status });
    return { kind: "skip" };
  }
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
    await writeLog(sql, { runId, kind: "skip", maleId: male.userId, reason: pick.reason });
    return { kind: "skip" };
  }

  const stall = byId.get(pick.stallId);
  if (!stall) {
    await writeLog(sql, { runId, kind: "skip", maleId: male.userId, reason: "没这具" });
    return { kind: "skip" };
  }

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
      await writeLog(sql, { runId, kind: "buy", maleId: male.userId, stallId: stall.id, name: stall.name });
      return { kind: "buy" };
    } catch (err) {
      note(notes, `${shortId(male.userId)} 买失败`);
      await writeLog(sql, { runId, kind: "skip", maleId: male.userId, stallId: stall.id, name: stall.name, reason: "买失败" });
      console.error("[sim-buy]", err);
      return { kind: "skip" };
    }
  }

  const selfUse = pick.reason === "self";
  const inquiryId = crypto.randomUUID();
  const locked = await lockRental(sql, stall.id, inquiryId);
  if (!locked) {
    note(notes, `${shortId(male.userId)} 锁败 ${stall.name}`);
    await writeLog(sql, { runId, kind: "skip", maleId: male.userId, stallId: stall.id, name: stall.name, reason: "锁败" });
    return { kind: "skip" };
  }
  let rentFen = 0;
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
      rentFen = grossFen;
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
    await writeLog(sql, {
      runId,
      kind: selfUse ? "self" : "rent",
      maleId: male.userId,
      stallId: stall.id,
      name: stall.name,
      fen: rentFen,
    });
    if (listedFen != null) {
      await writeLog(sql, {
        runId,
        kind: "list",
        maleId: male.userId,
        stallId: stall.id,
        name: stall.name,
        fen: listedFen,
        reason: "厌腻挂牌",
      });
    }
    return { kind: selfUse ? "self" : "rent", listed: listedFen != null };
  } catch (err) {
    await unlockRental(sql, inquiryId);
    await sql`
      update inquiries set status = 'cancelled', updated_at = now()
      where id = ${inquiryId} and coalesce(status, 'pending') = 'used'
    `;
    note(notes, `${shortId(male.userId)} 用失败`);
    await writeLog(sql, { runId, kind: "skip", maleId: male.userId, stallId: stall.id, name: stall.name, reason: "用失败" });
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

type LogRow = {
  runId: string;
  kind: string;
  maleId?: string;
  stallId?: string;
  name?: string;
  reason?: string;
  fen?: number;
};

async function writeLog(sql: Sql, row: LogRow) {
  await sql`
    insert into sim_log (id, run_id, at, kind, male_id, stall_id, name, reason, fen)
    values (
      ${crypto.randomUUID()},
      ${row.runId},
      now(),
      ${row.kind},
      ${row.maleId ?? null},
      ${row.stallId ?? null},
      ${row.name ?? ""},
      ${row.reason ?? ""},
      ${row.fen ?? 0}
    )
  `;
}

async function pruneSimLog(sql: Sql) {
  await sql`delete from sim_log where at < now() - interval '3 days'`;
  await sql`
    delete from sim_log
    where id in (
      select id from sim_log order by at desc offset 4000
    )
  `;
}

export type SimLogRow = {
  id: string;
  at: string;
  kind: string;
  maleId: string | null;
  maleName: string;
  stallId: string | null;
  name: string;
  reason: string;
  fen: number;
};

export type WorldSlice = {
  uses: number;
  selfUses: number;
  rents: number;
  buys: number;
  skipped: number;
  listed: number;
  wageFen: number;
  spendFen: number;
};

export type WorldStats = {
  h1: WorldSlice;
  h24: WorldSlice;
  all: { ticks: number; uses: number; selfUses: number; buys: number; listed: number; skipped: number };
  skips: { reason: string; n: number }[];
  platformFen: number;
  log: SimLogRow[];
  runs: SimRunRow[];
};

type SimRunRow = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  uses: number;
  selfUses: number;
  buys: number;
  listed: number;
  skipped: number;
  males: number;
  durationMs: number;
  notes: string[];
};

async function sliceSince(sql: Sql, since: string): Promise<WorldSlice> {
  const rows = await sql<{
    uses: number;
    self_uses: number;
    rents: number;
    buys: number;
    skipped: number;
    listed: number;
    wage_fen: number;
    spend_fen: number;
  }>`
    select
      count(*) filter (where kind in ('self', 'rent'))::int as uses,
      count(*) filter (where kind = 'self')::int as self_uses,
      count(*) filter (where kind = 'rent')::int as rents,
      count(*) filter (where kind = 'buy')::int as buys,
      count(*) filter (where kind = 'skip')::int as skipped,
      count(*) filter (where kind = 'list')::int as listed,
      coalesce(sum(fen) filter (where kind = 'wage'), 0)::int as wage_fen,
      coalesce(sum(fen) filter (where kind in ('rent', 'buy')), 0)::int as spend_fen
    from sim_log
    where at >= ${since}::timestamptz
  `;
  const r = rows[0];
  return {
    uses: Number(r?.uses ?? 0),
    selfUses: Number(r?.self_uses ?? 0),
    rents: Number(r?.rents ?? 0),
    buys: Number(r?.buys ?? 0),
    skipped: Number(r?.skipped ?? 0),
    listed: Number(r?.listed ?? 0),
    wageFen: Number(r?.wage_fen ?? 0),
    spendFen: Number(r?.spend_fen ?? 0),
  };
}

export async function loadWorldStats(sql: Sql): Promise<WorldStats> {
  const empty: WorldSlice = {
    uses: 0, selfUses: 0, rents: 0, buys: 0, skipped: 0, listed: 0, wageFen: 0, spendFen: 0,
  };
  let h1 = empty;
  let h24 = empty;
  try {
    h1 = await sliceSince(sql, new Date(Date.now() - 3600_000).toISOString());
    h24 = await sliceSince(sql, new Date(Date.now() - 24 * 3600_000).toISOString());
  } catch {
    h1 = empty;
    h24 = empty;
  }
  const allRows = await sql<{
    ticks: number;
    uses: number;
    self_uses: number;
    buys: number;
    listed: number;
    skipped: number;
  }>`
    select count(*)::int as ticks,
      coalesce(sum(uses),0)::int as uses,
      coalesce(sum(self_uses),0)::int as self_uses,
      coalesce(sum(buys),0)::int as buys,
      coalesce(sum(listed),0)::int as listed,
      coalesce(sum(skipped),0)::int as skipped
    from sim_runs
    where finished_at is not null
  `;
  const a = allRows[0];
  let skips: { reason: string; n: number }[] = [];
  try {
    skips = (
      await sql<{ reason: string; n: number }>`
        select coalesce(nullif(reason, ''), '(空)') as reason, count(*)::int as n
        from sim_log
        where kind = 'skip' and at >= ${new Date(Date.now() - 24 * 3600_000).toISOString()}::timestamptz
        group by 1
        order by n desc
        limit 12
      `
    ).map((r) => ({ reason: r.reason, n: Number(r.n) }));
  } catch {
    skips = [];
  }
  const plat = await sql<{ fen: number }>`
    select coalesce(fen, 0)::int as fen from wallets where user_id = 'platform' limit 1
  `;
  let log: SimLogRow[] = [];
  try {
    log = (
      await sql<{
        id: string;
        at: string;
        kind: string;
        male_id: string | null;
        male_name: string | null;
        stall_id: string | null;
        name: string;
        reason: string;
        fen: number;
      }>`
        select l.id, l.at, l.kind, l.male_id, coalesce(u.name, '') as male_name,
               l.stall_id, l.name, l.reason, l.fen
        from sim_log l
        left join "user" u on u.id = l.male_id
        order by l.at desc
        limit 80
      `
    ).map((r) => ({
      id: r.id,
      at: r.at,
      kind: r.kind,
      maleId: r.male_id,
      maleName: r.male_name || shortId(r.male_id ?? ""),
      stallId: r.stall_id,
      name: r.name ?? "",
      reason: r.reason ?? "",
      fen: Number(r.fen ?? 0),
    }));
  } catch {
    log = [];
  }
  const runRows = await sql<{
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
    limit 24
  `;
  return {
    h1,
    h24,
    all: {
      ticks: Number(a?.ticks ?? 0),
      uses: Number(a?.uses ?? 0),
      selfUses: Number(a?.self_uses ?? 0),
      buys: Number(a?.buys ?? 0),
      listed: Number(a?.listed ?? 0),
      skipped: Number(a?.skipped ?? 0),
    },
    skips,
    platformFen: Number(plat[0]?.fen ?? 0),
    log,
    runs: runRows.map((r) => ({
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
    })),
  };
}

function torontoDayKey(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

async function payDailyWage(sql: Sql, fen: number) {
  if (fen <= 0) return 0;
  const noteText = `日津贴 ${torontoDayKey()}`;
  const due = await sql<{ user_id: string }>`
    select s.user_id
    from user_state s
    where s.user_id like 'loc-m-%'
      and coalesce(s.role, 'male') = 'male'
      and coalesce(s.banned, false) = false
      and not exists (
        select 1 from ledger l
        where l.user_id = s.user_id and l.kind = 'wage' and l.note = ${noteText}
      )
  `;
  if (!due.length) return 0;
  for (let i = 0; i < due.length; i += 400) {
    const part = due.slice(i, i + 400);
    const ids = part.map((r) => r.user_id);
    await sql.query(
      `insert into wallets (user_id, fen)
       select u.id, $1 from unnest($2::text[]) as u(id)
       on conflict (user_id) do update set fen = wallets.fen + $1`,
      [fen, ids],
    );
    const ledgers = part.map(() => crypto.randomUUID());
    const notes = part.map(() => noteText);
    await sql.query(
      `insert into ledger (id, user_id, fen, kind, ref_id, note)
       select l.id, l.uid, $1, 'wage', null, l.note
       from unnest($2::text[], $3::text[], $4::text[]) as l(id, uid, note)`,
      [fen, ledgers, ids, notes],
    );
  }
  return due.length;
}

export async function enableAllMales(sql: Sql) {
  await sql`
    insert into behavior_male (user_id)
    select s.user_id
    from user_state s
    where coalesce(s.role, 'male') = 'male'
      and coalesce(s.banned, false) = false
    on conflict (user_id) do nothing
  `;
  await sql`
    update user_state u
    set lat = s.lat,
        lng = s.lng,
        loc_source = coalesce(u.loc_source, 'gps'),
        loc_updated_at = coalesce(u.loc_updated_at, now()),
        updated_at = now()
    from (
      select distinct on (owner_id) owner_id, lat, lng
      from stalls
      where owner_id is not null
        and lat is not null
        and lng is not null
      order by owner_id, updated_at desc nulls last
    ) s
    where u.user_id = s.owner_id
      and (u.lat is null or u.lng is null)
  `;
  const rows = await sql<{ user_id: string }>`
    update behavior_male m
    set sim_enabled = true, updated_at = now()
    from user_state s
    where s.user_id = m.user_id
      and coalesce(s.banned, false) = false
      and coalesce(s.role, 'male') = 'male'
      and m.sim_enabled = false
    returning m.user_id
  `;
  await sql`
    update behavior_stall
    set sim_enabled = true, updated_at = now()
    where sim_enabled = false
  `;
  return { n: rows.length };
}

/** @deprecated 全员打开，不再要求先有定位。 */
export const enableLocatedMales = enableAllMales;

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
