import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/auth/admin-middleware";
import { getSql, type Sql } from "@/lib/db";
import { ATTRACT_KEYS } from "@/lib/attract";
import { FIELD_DIMS, BIPOLAR_DIMS, MULTI_DIMS } from "@/lib/dims";
import { ECON_KEYS } from "@/lib/econ";
import { TASTE_KEYS } from "@/lib/male-params";
import type { WorldStats } from "@/lib/sim-tick";

export const DEFAULT_SIM = {
  nearbyRadiusM: 3000,
  locationIntervalSec: 180,
  rentSessionMin: 30,
  familyWeekCutPct: 20,
  familyCapPct: 80,
  otherWeekCutPct: 10,
  otherCapPct: 50,
  /** 保有分 = 主人分成 × (1-厌腻)。厌腻只按使用次数。低于此且已抽成才挂。 */
  listKeepThreshold: 0.45,
  /** 用几次厌腻到约 0.63。单位是次，不是周。 */
  satiationHalfUses: 4,
  selfUseSatiation: 1.35,
  platformSaleFen: 1000,
  platformRentFen: 200,
  wealthMeanCad: 100,
  wealthSigma: 0.9,
  marketUseNorm: 2.2,
  marketMulMin: 0.72,
  marketMulSpan: 0.58,
  rentFloorMul: 0.55,
  rentCeilMul: 1.85,
  /** 模拟 tick 节拍。loc-m 男人按 location status 醒来。 */
  simTickSec: 180,
  autoTick: 1,
  tickEverySec: 30,
  tickBatch: 80,
  dailyWageFen: 3000,
  useScoreMin: 0.35,
  selfUseScoreMin: 0.4,
  buyScoreMin: 0.2,
  maxConcurrentOrders: 1,
  dailyBudgetFen: 1500,
  walletStopFen: 200,
  boredSwitchMin: 0.55,
  buyCooldownHours: 24,
  /** 轴权重。0=不参与平均。关系已合成一轴。 */
  wAge: 1,
  wHeight: 1,
  wWeight: 1,
  wCup: 1,
  wPersonality: 1,
  wMarriage: 1,
  wDemeanor: 1,
  wMoan: 1,
  wSkill: 1,
  wOrgasm: 1,
  wFeel: 1,
  wPersona: 1,
  wCondom: 1,
  wLooks: 1,
  wRel: 1,
  econCashTight: 0.4,
  econPrestige: 0.18,
  econRentDrag: 0.08,
  /** 挂牌超过这些天无人买就撤。 */
  listStaleDays: 7,
  condomMatchMin: 0.25,
  enforceDailyQuota: 1,
  reviewReturnMin: 3,
};

export type SimConfig = typeof DEFAULT_SIM;

const SimSchema = z.object({
  nearbyRadiusM: z.number().int().min(200).max(50_000),
  locationIntervalSec: z.number().int().min(30).max(3600),
  rentSessionMin: z.number().int().min(5).max(240),
  familyWeekCutPct: z.number().int().min(1).max(50),
  familyCapPct: z.number().int().min(1).max(95),
  otherWeekCutPct: z.number().int().min(1).max(50),
  otherCapPct: z.number().int().min(1).max(95),
  listKeepThreshold: z.number().min(0.05).max(0.95),
  satiationHalfUses: z.number().min(1).max(20),
  selfUseSatiation: z.number().min(0.5).max(3),
  platformSaleFen: z.number().int().min(100).max(1_000_000),
  platformRentFen: z.number().int().min(50).max(100_000),
  wealthMeanCad: z.number().min(1).max(100_000),
  wealthSigma: z.number().min(0.2).max(2),
  marketUseNorm: z.number().min(0.2).max(20),
  marketMulMin: z.number().min(0.2).max(1),
  marketMulSpan: z.number().min(0).max(2),
  rentFloorMul: z.number().min(0.2).max(1),
  rentCeilMul: z.number().min(1).max(4),
  simTickSec: z.number().int().min(30).max(3600),
  autoTick: z.number().int().min(0).max(1),
  tickEverySec: z.number().int().min(10).max(600),
  tickBatch: z.number().int().min(5).max(500),
  dailyWageFen: z.number().int().min(0).max(100_000),
  useScoreMin: z.number().min(0).max(1),
  selfUseScoreMin: z.number().min(0).max(1),
  buyScoreMin: z.number().min(0).max(1),
  listStaleDays: z.number().int().min(1).max(90),
  dailyBudgetFen: z.number().int().min(0).max(1_000_000),
  maxConcurrentOrders: z.number().int().min(1).max(5),
  condomMatchMin: z.number().min(0).max(1),
  enforceDailyQuota: z.number().int().min(0).max(1),
  buyCooldownHours: z.number().int().min(0).max(720),
  reviewReturnMin: z.number().min(0).max(5),
  walletStopFen: z.number().int().min(0).max(1_000_000),
  boredSwitchMin: z.number().min(0).max(1),
  wAge: z.number().min(0).max(5),
  wHeight: z.number().min(0).max(5),
  wWeight: z.number().min(0).max(5),
  wCup: z.number().min(0).max(5),
  wPersonality: z.number().min(0).max(5),
  wMarriage: z.number().min(0).max(5),
  wDemeanor: z.number().min(0).max(5),
  wMoan: z.number().min(0).max(5),
  wSkill: z.number().min(0).max(5),
  wOrgasm: z.number().min(0).max(5),
  wFeel: z.number().min(0).max(5),
  wPersona: z.number().min(0).max(5),
  wCondom: z.number().min(0).max(5),
  wLooks: z.number().min(0).max(5),
  wRel: z.number().min(0).max(5),
  econCashTight: z.number().min(0).max(2),
  econPrestige: z.number().min(0).max(2),
  econRentDrag: z.number().min(0).max(2),
});

let cache: { at: number; cfg: SimConfig } | null = null;

export function mergeSim(raw: unknown): SimConfig {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_SIM };
  for (const key of Object.keys(DEFAULT_SIM) as (keyof SimConfig)[]) {
    const n = Number(src[key]);
    if (Number.isFinite(n)) (next as Record<string, number>)[key] = n;
  }
  return SimSchema.parse(next);
}

export async function loadSimConfig(sql?: Sql): Promise<SimConfig> {
  if (cache && Date.now() - cache.at < 4000) return cache.cfg;
  const db = sql ?? (await getSql());
  const rows = await db<{ data: unknown }>`select data from sim_config where id = 1 limit 1`;
  const cfg = mergeSim(rows[0]?.data);
  cache = { at: Date.now(), cfg };
  return cfg;
}

export function bustSimCache() {
  cache = null;
}

export function simDimWeights(cfg: SimConfig): Record<string, number> {
  return {
    age: cfg.wAge,
    height: cfg.wHeight,
    weight: cfg.wWeight,
    cup: cfg.wCup,
    personality: cfg.wPersonality,
    marriage: cfg.wMarriage,
    demeanor: cfg.wDemeanor,
    moan: cfg.wMoan,
    skill: cfg.wSkill,
    orgasm: cfg.wOrgasm,
    feel: cfg.wFeel,
    persona: cfg.wPersona,
    condom: cfg.wCondom,
    looks: cfg.wLooks,
    rel: cfg.wRel,
  };
}

export function simEconCoeffs(cfg: SimConfig) {
  return {
    cashTight: cfg.econCashTight,
    prestige: cfg.econPrestige,
    rentDrag: cfg.econRentDrag,
  };
}

async function loadLiveTextScale(sql: Sql) {
  const { loadTextScale, TEXT_SCALE_SEED } = await import("@/lib/text-scale");
  await loadTextScale(sql);
  const rows = await sql<{ field: string; option: string; axis: string; value: number }>`
    select field, option, axis, value from text_scale order by field, value
  `;
  if (!rows.length) return TEXT_SCALE_SEED;
  return rows.map((r) => ({
    field: r.field,
    option: r.option,
    axis: r.axis,
    value: Number(r.value),
  }));
}

export type AxisMean = { key: string; mean: number };
export type SimRunRow = {
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

export type SimSnapshot = {
  cfg: SimConfig;
  users: number;
  males: number;
  simEnabled: number;
  located: number;
  stalls: number;
  platformStalls: number;
  listed: number;
  busy: number;
  wallets: { n: number; avg: number; med: number; p90: number };
  market: { used7: number; online: number; busy: number; pressure: number; mul: number };
  satiation: { pairs: number; avgUses: number };
  lastRun: SimRunRow | null;
  locationApi: boolean;
  statuses: { status: string; n: number }[];
  world: WorldStats | null;
  econ: AxisMean[];
  taste: AxisMean[];
  person: AxisMean[];
  relations: { rel: string; n: number }[];
  attractKeys: readonly string[];
  fieldDims: readonly string[];
  bipolarDims: readonly string[];
  multiDims: readonly string[];
  econKeys: readonly string[];
  tasteKeys: readonly string[];
  textScale: { field: string; option: string; axis: string; value: number }[];
};

export const getSimAdmin = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<SimSnapshot> => {
    const sql = await getSql();
    const cfg = await loadSimConfig(sql);
    const miss = await sql<{ n: number }>`
      select count(*)::int as n from behavior_male
      where jsonb_typeof(dims->'personality') is distinct from 'object'
    `;
    if (Number(miss[0]?.n ?? 0) > 0) {
      const { fillMissingMaleDims } = await import("@/lib/dims");
      await fillMissingMaleDims(sql);
    }
    const head = await sql<{
      users: number;
      males: number;
      sim_enabled: number;
      located: number;
      stalls: number;
      platform_stalls: number;
      listed: number;
      busy: number;
    }>`
      select
        (select count(*)::int from "user") as users,
        (select count(*)::int from user_state where role = 'male') as males,
        (select count(*)::int from behavior_male where sim_enabled = true) as sim_enabled,
        (select count(*)::int from user_state s
          join behavior_male m on m.user_id = s.user_id
          where m.sim_enabled = true and s.lat is not null) as located,
        (select count(*)::int from stalls) as stalls,
        (select count(*)::int from stalls where owner_id = 'platform') as platform_stalls,
        (select count(*)::int from stalls where listed_fen is not null) as listed,
        (select count(*)::int from stalls where busy_until is not null and busy_until > now()) as busy
    `;
    const wallets = await sql<{ n: number; avg: number; med: number; p90: number }>`
      select count(*)::int as n,
        coalesce(avg(fen),0)::int as avg,
        coalesce(percentile_cont(0.5) within group (order by fen),0)::int as med,
        coalesce(percentile_cont(0.9) within group (order by fen),0)::int as p90
      from wallets w
      join user_state s on s.user_id = w.user_id and s.role = 'male'
    `;
    const used = await sql<{ used7: number; online: number }>`
      select
        (select count(*)::int from inquiries
          where coalesce(status,'pending')='used'
            and coalesce(updated_at, created_at) >= now() - interval '7 days') as used7,
        (select count(*)::int from stalls where online and coalesce(hidden,false)=false) as online
    `;
    const sat = await sql<{ pairs: number; avg_uses: number }>`
      select count(*)::int as pairs, coalesce(avg(uses),0)::float as avg_uses from behavior_satiation
    `;
    const econRows = await sql<Record<string, number>>`
      select
        avg(cash_tight)::float as cash_tight,
        avg(bargain)::float as bargain,
        avg(flip)::float as flip,
        avg(hold)::float as hold,
        avg(rent)::float as rent,
        avg(prestige)::float as prestige,
        avg(family_liquidate)::float as family_liquidate,
        avg(use_over_own)::float as use_over_own
      from behavior_econ
    `;
    const personRows = await sql<Record<string, number>>`
      select
        avg(sociability)::float as sociability,
        avg(routine_preference)::float as routine_preference,
        avg(spontaneity)::float as spontaneity,
        avg(travel_tolerance)::float as travel_tolerance,
        avg(nightlife_preference)::float as nightlife_preference,
        avg(activity_budget)::float as activity_budget,
        avg(family_orientation)::float as family_orientation,
        avg(warmth)::float as warmth,
        avg(directness)::float as directness,
        avg(patience)::float as patience
      from behavior_person
    `;
    const tasteRows = await sql<{ key: string; mean: number }>`
      select k as key, avg((taste ->> k)::float)::float as mean
      from behavior_male,
        unnest(array['母亲','妻子','女儿','女友','兄妹','朋友','同事','路人']) as k
      where taste ? k
      group by k
    `;
    const rels = await sql<{ rel: string; n: number }>`
      select coalesce(relation, '平台/无关系') as rel, count(*)::int as n
      from stalls group by 1 order by n desc
    `;
    const online = Math.max(1, Number(used[0]?.online ?? 1));
    const used7 = Number(used[0]?.used7 ?? 0);
    const busy = Number(head[0]?.busy ?? 0);
    const per = used7 / online;
    const pressure = Math.min(1, Math.max(0, (per / cfg.marketUseNorm) * 0.65 + (busy / online) * 0.35));
    const e0 = econRows[0] ?? {};
    const p0 = personRows[0] ?? {};
    const { latestSimRun, loadWorldStats } = await import("@/lib/sim-tick");
    const { locationApiBase } = await import("@/lib/location-sim");
    let lastRun = null;
    try {
      lastRun = await latestSimRun(sql);
    } catch {
      lastRun = null;
    }
    let world: WorldStats | null = null;
    try {
      world = await loadWorldStats(sql);
    } catch {
      world = null;
    }
    let statuses: { status: string; n: number }[] = [];
    try {
      statuses = (
        await sql<{ status: string; n: number }>`
          select coalesce(nullif(s.loc_status, ''), '(无)') as status, count(*)::int as n
          from user_state s
          join behavior_male m on m.user_id = s.user_id
          where m.sim_enabled = true and m.user_id like 'loc-m-%'
          group by 1
          order by n desc
          limit 12
        `
      ).map((r) => ({ status: r.status, n: Number(r.n) }));
    } catch {
      statuses = [];
    }
    return {
      cfg,
      users: Number(head[0]?.users ?? 0),
      males: Number(head[0]?.males ?? 0),
      simEnabled: Number(head[0]?.sim_enabled ?? 0),
      located: Number(head[0]?.located ?? 0),
      stalls: Number(head[0]?.stalls ?? 0),
      platformStalls: Number(head[0]?.platform_stalls ?? 0),
      listed: Number(head[0]?.listed ?? 0),
      busy,
      wallets: {
        n: Number(wallets[0]?.n ?? 0),
        avg: Number(wallets[0]?.avg ?? 0),
        med: Number(wallets[0]?.med ?? 0),
        p90: Number(wallets[0]?.p90 ?? 0),
      },
      market: {
        used7,
        online,
        busy,
        pressure,
        mul: cfg.marketMulMin + cfg.marketMulSpan * pressure,
      },
      satiation: { pairs: Number(sat[0]?.pairs ?? 0), avgUses: Number(sat[0]?.avg_uses ?? 0) },
      lastRun,
      locationApi: Boolean(locationApiBase()),
      statuses,
      world,
      econ: ECON_KEYS.map((key) => ({ key, mean: Number(e0[key] ?? 0) })),
      taste: TASTE_KEYS.map((key) => {
        const hit = tasteRows.find((r) => r.key === key);
        return { key, mean: Number(hit?.mean ?? 0) };
      }),
      person: [
        "sociability",
        "routine_preference",
        "spontaneity",
        "travel_tolerance",
        "nightlife_preference",
        "activity_budget",
        "family_orientation",
        "warmth",
        "directness",
        "patience",
      ].map((key) => ({ key, mean: Number(p0[key] ?? 0) })),
      relations: rels,
      attractKeys: ATTRACT_KEYS,
      fieldDims: FIELD_DIMS,
      bipolarDims: BIPOLAR_DIMS,
      multiDims: MULTI_DIMS,
      econKeys: ECON_KEYS,
      tasteKeys: TASTE_KEYS,
      textScale: await loadLiveTextScale(sql),
    };
  });

export const saveSimAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => SimSchema.parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into sim_config (id, data, updated_at)
      values (1, ${JSON.stringify(data)}::jsonb, now())
      on conflict (id) do update set data = excluded.data, updated_at = now()
    `;
    bustSimCache();
    return data;
  });

const TextScaleRow = z.object({
  field: z.string().min(1),
  option: z.string().min(1),
  axis: z.string().min(1),
  value: z.number().min(0).max(1),
});

export const saveTextScaleAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => z.array(TextScaleRow).min(1).max(200).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    for (const row of data) {
      await sql`
        insert into text_scale (field, option, axis, value)
        values (${row.field}, ${row.option}, ${row.axis}, ${row.value})
        on conflict (field, option, axis) do update set value = excluded.value
      `;
    }
    const { bustTextScaleCache } = await import("@/lib/text-scale");
    bustTextScaleCache();
    return data;
  });

export const runSimTickAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const { runSimTick } = await import("@/lib/sim-tick");
    return runSimTick(sql);
  });

export const enableSimLocatedAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const { enableAllMales } = await import("@/lib/sim-tick");
    return enableAllMales(sql);
  });
