import type { Sql } from "@/lib/db";
import { TASTE_KEYS, type BudgetBand, type CondomPref, type SessionStyle } from "@/lib/male-params";
import type { Profile } from "@/lib/profiles";
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
export const BIPOLAR_DIMS = ["age", "height", "weight", "cup"] as const;
export type DimMap = Record<string, number>;

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

export function stallDims(p: Profile): DimMap {
  const scale = currentTextScale();
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

/** 男人补和肉厕同一套字段。胸/年龄/身高/体重：-1～1；其余 0～1 目标程度。 */
export function deriveMaleDims(m: MaleDimInput): DimMap {
  const o = clamp01(m.objectify);
  const nov = clamp01(m.novelty);
  const family = clamp01(m.familyOrientation);
  const cup = clamp11(o * 1.7 - 0.55);
  const condom =
    m.condomPref === "无套优先" ? 0.95 : m.condomPref === "必须套" ? 0.08 : 0.45;
  const out: DimMap = {
    age: clamp11(0.15 - nov * 1.1),
    height: clamp11(o * 0.45 - 0.05),
    weight: clamp11(0.15 - o * 0.55),
    cup,
    personality: clamp01(0.35 + o * 0.4 + family * 0.15),
    marriage: clamp01(family * 0.7 + ( (m.age ?? 30) > 34 ? 0.2 : 0)),
    demeanor: clamp01(o * 0.85 + 0.1),
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

export function dimScore(male: DimMap, stall: DimMap) {
  const keys = new Set([...FIELD_DIMS, ...TASTE_KEYS.map((k) => `rel_${k}`)]);
  let s = 0;
  let n = 0;
  for (const key of keys) {
    const mv = male[key];
    const sv = stall[key];
    if (mv == null || sv == null) continue;
    n += 1;
    if (isBipolar(key)) {
      s += (clamp11(mv) * (clamp01(sv) * 2 - 1) + 1) / 2;
    } else if (key.startsWith("rel_")) {
      s += clamp01(mv) * clamp01(sv);
    } else {
      s += 1 - Math.abs(clamp01(mv) - clamp01(sv));
    }
  }
  return n ? s / n : 0;
}

export function rankByDims(
  male: DimMap,
  stalls: Profile[],
  econ?: import("@/lib/econ").EconVec | Record<EconKey, number>,
) {
  return [...stalls]
    .map((p) => {
      const a = dimScore(male, stallDims(p));
      const score = econ ? scoreWithEcon(a, p.hourFen, econ) : a;
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
    return male[0].dims;
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
    where m.dims is null or m.dims = '{}'::jsonb
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
