import type { Sql } from "@/lib/db";
import { TASTE_KEYS, type BudgetBand, type CondomPref, type SessionStyle } from "@/lib/male-params";
import { type Profile } from "@/lib/profiles";
import { currentTextScale, scaleOf } from "@/lib/text-scale";
import { scoreWithEcon, type EconKey } from "@/lib/econ";

/** 挂牌原字段。不做 lewd/looks/nightlife 那种压缩映射。 */
export const FIELD_DIMS = [
  "age",
  "height",
  "weight",
  "cup",
  "personality",
  "marriage",
  "demeanor",
  "moan",
  "skill",
  "orgasm",
  "feel",
  "persona",
  "condom",
  "looks",
] as const;

export type FieldDim = (typeof FIELD_DIMS)[number];
export const BIPOLAR_DIMS = ["age", "height", "weight"] as const;
export const MULTI_DIMS = ["cup", "personality", "demeanor"] as const;
export type DimMap = Record<string, number | Record<string, number>>;

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, n));
}
function clamp01(n: number) {
  return clamp(n, 0, 1);
}
function clamp11(n: number) {
  return clamp(n, -1, 1);
}

export function isBipolar(key: string) {
  return (BIPOLAR_DIMS as readonly string[]).includes(key);
}

export function isMulti(key: string) {
  return (MULTI_DIMS as readonly string[]).includes(key);
}

function num(v: unknown, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function optionMap(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, number>;
}

function optionScore(maleVal: unknown, stallOption: string | null | undefined) {
  const map = optionMap(maleVal);
  if (!map || !stallOption) return 0.5;
  return (clamp11(Number(map[stallOption] ?? 0)) + 1) / 2;
}

export function stallDims(p: Profile, scale = currentTextScale()): DimMap {
  const out: DimMap = {
    age: clamp01(((Number(p.age) || 28) - 18) / 25),
    height: clamp01(((Number(p.heightCm) || 160) - 155) / 25),
    weight: clamp01(((Number(p.weightKg) || 50) - 42) / 38),
    cup: scaleOf(scale, "cup", p.cup, "cup", 0.5),
    personality: scaleOf(scale, "personality", p.personality, "personality", 0.45),
    marriage: p.marriage === "已婚已育" ? 0.85 : p.marriage === "已婚未育" ? 0.55 : 0.2,
    demeanor: scaleOf(scale, "demeanor", p.demeanor, "demeanor", 0.45),
    moan: scaleOf(scale, "moan", p.moan, "moan", 0.4),
    skill: scaleOf(scale, "skill", p.skillLevel, "skill", 0.4),
    orgasm: scaleOf(scale, "orgasm", p.orgasm, "orgasm", 0.5),
    feel: scaleOf(scale, "feel", p.feel, "feel", 0.45),
    persona: scaleOf(scale, "persona", p.persona, "persona", 0.45),
    condom: scaleOf(scale, "condom", p.condom, "condom", 0.3),
    looks: clamp01((p.sellingPoints ?? []).length / 5),
  };
  for (const rel of TASTE_KEYS) {
    out[`rel_${rel}`] = p.relation === rel ? 1 : 0;
  }
  if (!p.relation || p.relation === "其他") out.rel_路人 = 1;
  return out;
}

export type MaleDimInput = {
  age: number | null;
  taste: Record<string, number>;
  sessionStyle: SessionStyle | string;
  condomPref: CondomPref | string;
  objectify: number;
  novelty: number;
  risk: number;
  budgetBand: BudgetBand | string;
  familyOrientation: number;
};

/** 男人同一套字段。cup/personality/demeanor 是对各选项的 -1～1，可多项同时为正。 */
export function deriveMaleDims(m: MaleDimInput): DimMap {
  const o = clamp01(m.objectify);
  const nov = clamp01(m.novelty);
  const family = clamp01(m.familyOrientation);
  const condom =
    m.condomPref === "无套优先" ? 0.95 : m.condomPref === "必须套" ? 0.08 : 0.45;
  const cup: Record<string, number> = {
    B: clamp11(0.4 - o * 1.15),
    C: clamp11(0.35 - o * 0.15),
    D: clamp11(o * 0.95 - 0.12),
    E: clamp11(o * 1.35 - 0.4),
  };
  const personality: Record<string, number> = {
    温顺讨好: clamp11(o * 0.85 + family * 0.35 - 0.15),
    软萌粘人: clamp11(0.15 + o * 0.25 + family * 0.2),
    内向闷骚: clamp11(0.05 + o * 0.45),
    清高要强: clamp11((1 - o) * 0.95 - 0.2),
    冷淡疏离: clamp11((1 - o) * 0.7 - 0.25),
    外向热闹: clamp11(0.05 + (1 - family) * 0.35),
    作精骄纵: clamp11(o * 0.6 - 0.18),
    隐忍顾家: clamp11(family * 0.95 + (1 - o) * 0.1 - 0.15),
  };
  const demeanor: Record<string, number> = {
    被动保守呆板生涩: clamp11((1 - o) * 0.85 - 0.1),
    羞涩需要引导鼓励: clamp11((1 - o) * 0.55 + 0.08),
    自然开放积极配合: clamp11(0.12 + o * 0.2),
    风骚风情诱人魅惑: clamp11(o * 0.75 - 0.08),
    主动豪放热情放荡: clamp11(o * 0.95 - 0.18),
    卑微下贱无脑淫痴: clamp11(o * 1.15 - 0.35),
  };
  const out: DimMap = {
    age: clamp11(0.15 - nov * 1.1),
    height: clamp11(o * 0.45 - 0.05),
    weight: clamp11(0.15 - o * 0.55),
    cup,
    personality,
    marriage: clamp01(family * 0.7 + ((m.age ?? 30) > 34 ? 0.2 : 0)),
    demeanor,
    moan: clamp01(o * 0.8 + 0.08),
    skill: m.sessionStyle === "快餐灌注" ? 0.35 : 0.75,
    orgasm: clamp01(0.3 + o * 0.55),
    feel: clamp01(0.25 + o * 0.6),
    persona: clamp01(o),
    condom,
    looks: clamp01(0.35 + o * 0.45),
  };
  for (const rel of TASTE_KEYS) {
    out[`rel_${rel}`] = clamp01(Number(m.taste?.[rel] ?? 0));
  }
  return out;
}

export type AxisHit = { key: string; match: number; weight: number };
export type EconCoeffs = { cashTight?: number; prestige?: number; rentDrag?: number };

function axisWeight(weights: Record<string, number> | undefined, key: string) {
  if (!weights) return 1;
  const n = Number(weights[key]);
  return Number.isFinite(n) ? Math.max(0, n) : 1;
}

function axisMatch(male: DimMap, stall: DimMap, profile: Profile, key: string) {
  const mv = male[key];
  const sv = stall[key];
  if (mv == null) return null;
  if (key === "cup") return optionScore(mv, profile.cup);
  if (key === "personality") return optionScore(mv, profile.personality);
  if (key === "demeanor") return optionScore(mv, profile.demeanor);
  if (isBipolar(key)) return (clamp11(num(mv)) * (clamp01(num(sv)) * 2 - 1) + 1) / 2;
  return 1 - Math.abs(clamp01(num(mv)) - clamp01(num(sv)));
}

/** 关系合成一轴：只看她的关系对应男人的 taste，不再被另外 7 个 0 稀释。 */
export function axisHits(
  male: DimMap,
  stall: DimMap,
  profile: Profile,
  weights?: Record<string, number>,
): AxisHit[] {
  const hits: AxisHit[] = [];
  for (const key of FIELD_DIMS) {
    const match = axisMatch(male, stall, profile, key);
    if (match == null) continue;
    const weight = axisWeight(weights, key);
    if (weight <= 0) continue;
    hits.push({ key, match, weight });
  }
  const relName = !profile.relation || profile.relation === "其他" ? "路人" : profile.relation;
  const relW = axisWeight(weights, "rel");
  if (relW > 0) {
    hits.push({
      key: "rel",
      match: clamp01(num(male[`rel_${relName}`])),
      weight: relW,
    });
  }
  return hits;
}

export function dimScore(
  male: DimMap,
  stall: DimMap,
  profile: Profile,
  weights?: Record<string, number>,
) {
  const hits = axisHits(male, stall, profile, weights);
  let s = 0;
  let n = 0;
  for (const h of hits) {
    s += h.match * h.weight;
    n += h.weight;
  }
  return n ? s / n : 0;
}

export function rankByDims(
  male: DimMap,
  stalls: Profile[],
  econ?: import("@/lib/econ").EconVec | Record<EconKey, number>,
  opts?: { weights?: Record<string, number>; econCoeffs?: EconCoeffs },
) {
  return [...stalls]
    .map((p) => {
      const a = dimScore(male, stallDims(p), p, opts?.weights);
      const score = econ ? scoreWithEcon(a, p.hourFen, econ, opts?.econCoeffs) : a;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || (a.p.distanceM ?? 0) - (b.p.distanceM ?? 0))
    .map((row) => row.p);
}

export async function loadMaleDims(sql: Sql, userId: string): Promise<DimMap> {
  const ageRows = await sql<{ age: number | null }>`
    select age from user_state where user_id = ${userId} limit 1
  `;
  const age = ageRows[0]?.age ?? null;
  const male = await sql<{
    taste: Record<string, number> | string;
    session_style: string;
    condom_pref: string;
    objectify: number;
    novelty: number;
    risk: number;
    budget_band: string;
    person_id: string | null;
    dims: DimMap | string | null;
  }>`
    select taste, session_style, condom_pref, objectify, novelty, risk, budget_band, person_id, dims
    from behavior_male where user_id = ${userId} limit 1
  `;
  if (!male[0]) {
    return deriveMaleDims({
      age,
      taste: { 女友: 0.55, 路人: 0.5, 妻子: 0.2, 母亲: 0.1, 女儿: 0.1, 兄妹: 0.05, 朋友: 0.25, 同事: 0.2 },
      sessionStyle: "快餐灌注",
      condomPref: "看货",
      objectify: 0.55,
      novelty: 0.45,
      risk: 0.35,
      budgetBand: "中",
      familyOrientation: 0.3,
    });
  }
  if (male[0].dims && typeof male[0].dims === "object" && Object.keys(male[0].dims).length) {
    if (typeof male[0].dims.personality === "object") return male[0].dims;
  }
  if (typeof male[0].dims === "string") {
    try {
      const parsed = JSON.parse(male[0].dims) as DimMap;
      if (parsed && Object.keys(parsed).length) return parsed;
    } catch {
      /* fallthrough */
    }
  }
  let familyOrientation = 0.3;
  if (male[0].person_id) {
    const p = await sql<{ family_orientation: number }>`
      select family_orientation from behavior_person where person_id = ${male[0].person_id} limit 1
    `;
    familyOrientation = Number(p[0]?.family_orientation ?? 0.3);
  }
  const taste =
    typeof male[0].taste === "string"
      ? (JSON.parse(male[0].taste) as Record<string, number>)
      : male[0].taste;
  const dims = deriveMaleDims({
    age,
    taste: taste ?? {},
    sessionStyle: male[0].session_style,
    condomPref: male[0].condom_pref,
    objectify: Number(male[0].objectify),
    novelty: Number(male[0].novelty),
    risk: Number(male[0].risk),
    budgetBand: male[0].budget_band,
    familyOrientation,
  });
  await sql`
    update behavior_male set dims = ${JSON.stringify(dims)}::jsonb, updated_at = now()
    where user_id = ${userId} and (dims is null or dims = '{}'::jsonb)
  `;
  return dims;
}

export async function fillMissingMaleDims(sql: Sql, limit = 4000) {
  const rows = await sql<{
    user_id: string;
    taste: Record<string, number> | string;
    session_style: string;
    condom_pref: string;
    objectify: number;
    novelty: number;
    risk: number;
    budget_band: string;
    person_id: string | null;
    age: number | null;
    family_orientation: number | null;
  }>`
    select m.user_id, m.taste, m.session_style, m.condom_pref, m.objectify, m.novelty, m.risk,
           m.budget_band, m.person_id, u.age, p.family_orientation
    from behavior_male m
    left join user_state u on u.user_id = m.user_id
    left join behavior_person p on p.person_id = m.person_id
    where jsonb_typeof(m.dims->'personality') is distinct from 'object'
    limit ${limit}
  `;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    await Promise.all(
      chunk.map(async (row) => {
        const taste =
          typeof row.taste === "string" ? (JSON.parse(row.taste) as Record<string, number>) : row.taste;
        const dims = deriveMaleDims({
          age: row.age,
          taste: taste ?? {},
          sessionStyle: row.session_style,
          condomPref: row.condom_pref,
          objectify: Number(row.objectify),
          novelty: Number(row.novelty),
          risk: Number(row.risk),
          budgetBand: row.budget_band,
          familyOrientation: Number(row.family_orientation ?? 0.3),
        });
        await sql`
          update behavior_male set dims = ${JSON.stringify(dims)}::jsonb, updated_at = now()
          where user_id = ${row.user_id}
        `;
      }),
    );
  }
  return rows.length;
}
