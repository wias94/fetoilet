import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/auth/admin-middleware";
import { getSql, type Sql } from "@/lib/db";
import { ATTRACT_KEYS } from "@/lib/attract";
import { ECON_KEYS } from "@/lib/econ";
import { TASTE_KEYS } from "@/lib/male-params";

export const DEFAULT_SIM = {
  nearbyRadiusM: 3000,
  locationIntervalSec: 180,
  rentSessionMin: 30,
  familyWeekCutPct: 20,
  familyCapPct: 80,
  otherWeekCutPct: 10,
  otherCapPct: 50,
  /** 保有分 = 主人分成 × (1-厌腻)。低于此才自动挂转让。第一周分成 100% 不会挂。 */
  listKeepThreshold: 0.45,
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

export type AxisMean = { key: string; mean: number };
export type SimSnapshot = {
  cfg: SimConfig;
  users: number;
  males: number;
  stalls: number;
  platformStalls: number;
  listed: number;
  busy: number;
  wallets: { n: number; avg: number; med: number; p90: number };
  market: { used7: number; online: number; busy: number; pressure: number; mul: number };
  satiation: { pairs: number; avgUses: number };
  econ: AxisMean[];
  taste: AxisMean[];
  person: AxisMean[];
  relations: { rel: string; n: number }[];
  attractKeys: readonly string[];
  econKeys: readonly string[];
  tasteKeys: readonly string[];
};

export const getSimAdmin = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<SimSnapshot> => {
    const sql = await getSql();
    const cfg = await loadSimConfig(sql);
    const head = await sql<{
      users: number;
      males: number;
      stalls: number;
      platform_stalls: number;
      listed: number;
      busy: number;
    }>`
      select
        (select count(*)::int from "user") as users,
        (select count(*)::int from user_state where role = 'male') as males,
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
    return {
      cfg,
      users: Number(head[0]?.users ?? 0),
      males: Number(head[0]?.males ?? 0),
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
      econKeys: ECON_KEYS,
      tasteKeys: TASTE_KEYS,
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
