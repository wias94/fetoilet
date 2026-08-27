import type { Sql } from "@/lib/db";
import { scoreWithEcon, type EconKey } from "@/lib/econ";
import { TASTE_KEYS, type BudgetBand, type CondomPref, type SessionStyle } from "@/lib/male-params";
import type { Profile } from "@/lib/profiles";

/** 男女共用的轴。男人 = 想要什么，肉厕 = 是什么。点乘 / 模 = 吸引力。 */
export const ATTRACT_KEYS = [
  "rel_母亲",
  "rel_妻子",
  "rel_女儿",
  "rel_女友",
  "rel_兄妹",
  "rel_朋友",
  "rel_同事",
  "rel_路人",
  "age_young",
  "age_mid",
  "bare",
  "session_fast",
  "session_night",
  "session_keep",
  "lewd",
  "obedient",
  "skill",
  "looks",
  "cheap",
  "premium",
  "nightlife",
  "family",
  "risk",
  "novelty",
] as const;

export type AttractKey = (typeof ATTRACT_KEYS)[number];
export type AttractVec = number[];

export type MaleAttractInput = {
  age: number | null;
  taste: Record<string, number>;
  sessionStyle: SessionStyle | string;
  condomPref: CondomPref | string;
  objectify: number;
  novelty: number;
  risk: number;
  budgetBand: BudgetBand | string;
  nightlife: number;
  familyOrientation: number;
  routine: number;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function idx(list: readonly string[], value: string | undefined) {
  const i = list.indexOf(value ?? "");
  return i < 0 ? 0 : i / Math.max(1, list.length - 1);
}

function unit(vec: AttractVec): AttractVec {
  const n = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (n < 1e-6) return vec.map(() => 0);
  return vec.map((x) => x / n);
}

export function emptyVec(): AttractVec {
  return ATTRACT_KEYS.map(() => 0);
}

export function maleVector(m: MaleAttractInput): AttractVec {
  const taste = m.taste ?? {};
  const age = m.age ?? 30;
  const youngWant = clamp01(m.novelty * 0.55 + (45 - age) / 40);
  const midWant = clamp01(m.routine * 0.5 + (age - 28) / 40);
  const bare =
    m.condomPref === "无套优先" ? 1 : m.condomPref === "必须套" ? 0.05 : 0.45;
  const cheap = m.budgetBand === "低" ? 1 : m.budgetBand === "高" ? 0.15 : 0.5;
  const v: Record<AttractKey, number> = {
    rel_母亲: clamp01(Number(taste["母亲"] ?? 0)),
    rel_妻子: clamp01(Number(taste["妻子"] ?? 0)),
    rel_女儿: clamp01(Number(taste["女儿"] ?? 0)),
    rel_女友: clamp01(Number(taste["女友"] ?? 0)),
    rel_兄妹: clamp01(Number(taste["兄妹"] ?? 0)),
    rel_朋友: clamp01(Number(taste["朋友"] ?? 0)),
    rel_同事: clamp01(Number(taste["同事"] ?? 0)),
    rel_路人: clamp01(Number(taste["路人"] ?? 0)),
    age_young: youngWant,
    age_mid: midWant,
    bare,
    session_fast: m.sessionStyle === "快餐灌注" ? 1 : 0.2,
    session_night: m.sessionStyle === "过夜" ? 1 : 0.25,
    session_keep: m.sessionStyle === "包厕" ? 1 : 0.15,
    lewd: clamp01(m.objectify),
    obedient: clamp01(0.3 + m.objectify * 0.5),
    skill: m.sessionStyle === "快餐灌注" ? 0.35 : 0.8,
    looks: clamp01(0.55 + m.objectify * 0.25),
    cheap,
    premium: 1 - cheap,
    nightlife: clamp01(m.nightlife),
    family: clamp01(m.familyOrientation),
    risk: clamp01(m.risk),
    novelty: clamp01(m.novelty),
  };
  return unit(ATTRACT_KEYS.map((k) => v[k]));
}

const DEMEANOR_LEWD = [
  "被动保守呆板生涩",
  "羞涩需要引导鼓励",
  "自然开放积极配合",
  "风骚风情诱人魅惑",
  "主动豪放热情放荡",
  "卑微下贱无脑淫痴",
];
const PERSONA_LEWD = [
  "有待开发的良家",
  "反差装逼的婊子",
  "风情万种的骚货",
  "淫荡风骚的荡妇",
  "欠操下贱的母狗",
  "专业熟练的妓女",
];
const SKILL = ["入门基础级", "常规伴侣级", "优质情人级", "专业技师级"];
const LOOKS = ["高颜值", "巨乳", "美臀", "身材好", "皮肤好", "长腿美足", "气质反差"];

export function stallVector(p: Profile): AttractVec {
  const rel = p.relation && TASTE_KEYS.includes(p.relation as (typeof TASTE_KEYS)[number]) ? p.relation : "路人";
  const age = Number(p.age) || 28;
  const condom = p.condom ?? "";
  const bare =
    condom.includes("均可无套") ? 1 : condom.includes("加钱") ? 0.7 : condom.includes("看人") ? 0.45 : 0.08;
  const hours = p.hoursTag ?? "";
  const quota = p.dailyQuota ?? "";
  const points = p.sellingPoints ?? [];
  const extras = (p.extras ?? []).map((e) => e.name);
  const hour = Math.max(1, p.hourFen);
  const cheap = clamp01(1 - (hour - 200) / 1800);
  const v: Record<AttractKey, number> = {
    rel_母亲: rel === "母亲" ? 1 : 0,
    rel_妻子: rel === "妻子" ? 1 : 0,
    rel_女儿: rel === "女儿" ? 1 : 0,
    rel_女友: rel === "女友" ? 1 : 0,
    rel_兄妹: rel === "兄妹" ? 1 : 0,
    rel_朋友: rel === "朋友" ? 1 : 0,
    rel_同事: rel === "同事" ? 1 : 0,
    rel_路人: rel === "路人" || rel === "其他" || !p.relation ? 1 : 0,
    age_young: clamp01((32 - age) / 14),
    age_mid: clamp01(1 - Math.abs(age - 38) / 18),
    bare,
    session_fast: quota.includes("不限") || hours.includes("全天") ? 0.9 : 0.35,
    session_night: hours.includes("晚上") || (p.tags ?? []).includes("night") ? 1 : 0.2,
    session_keep: quota.includes("一天一客") ? 1 : 0.2,
    lewd: (idx(DEMEANOR_LEWD, p.demeanor ?? "") + idx(PERSONA_LEWD, p.persona ?? "")) / 2,
    obedient:
      p.personality === "温顺讨好" || p.personality === "隐忍顾家" || p.persona === "欠操下贱的母狗"
        ? 0.9
        : 0.35,
    skill: idx(SKILL, p.skillLevel ?? ""),
    looks: clamp01(points.filter((x) => LOOKS.includes(x)).length / 4),
    cheap,
    premium: 1 - cheap,
    nightlife: hours.includes("晚上") || (p.tags ?? []).includes("night") ? 1 : 0.25,
    family: ["母亲", "妻子", "女儿", "兄妹"].includes(rel) ? 1 : 0,
    risk: clamp01(
      (extras.some((n) => n.includes("性虐") || n.includes("肛") || n.includes("录像")) ? 0.55 : 0) +
        bare * 0.45,
    ),
    novelty: p.unowned || (p.holdWeeks ?? 0) === 0 ? 0.85 : clamp01(1 - (p.holdWeeks ?? 0) / 8),
  };
  return unit(ATTRACT_KEYS.map((k) => v[k]));
}

export function attractiveness(male: AttractVec, stall: AttractVec) {
  let s = 0;
  const n = Math.min(male.length, stall.length);
  for (let i = 0; i < n; i += 1) s += male[i] * stall[i];
  return clamp01((s + 1) / 2);
}

export function defaultMaleInput(age: number | null): MaleAttractInput {
  return {
    age,
    taste: { 女友: 0.55, 路人: 0.5, 妻子: 0.2, 母亲: 0.1, 女儿: 0.1, 兄妹: 0.05, 朋友: 0.25, 同事: 0.2 },
    sessionStyle: "快餐灌注",
    condomPref: "看货",
    objectify: 0.55,
    novelty: 0.45,
    risk: 0.35,
    budgetBand: "中",
    nightlife: 0.45,
    familyOrientation: 0.3,
    routine: 0.45,
  };
}

export async function loadMaleVector(sql: Sql, userId: string): Promise<AttractVec> {
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
  }>`
    select taste, session_style, condom_pref, objectify, novelty, risk, budget_band, person_id
    from behavior_male where user_id = ${userId} limit 1
  `;
  if (!male[0]) return maleVector(defaultMaleInput(age));
  let nightlife = 0.45;
  let familyOrientation = 0.3;
  let routine = 0.45;
  if (male[0].person_id) {
    const p = await sql<{
      nightlife_preference: number;
      family_orientation: number;
      routine_preference: number;
    }>`
      select nightlife_preference, family_orientation, routine_preference
      from behavior_person where person_id = ${male[0].person_id} limit 1
    `;
    if (p[0]) {
      nightlife = Number(p[0].nightlife_preference);
      familyOrientation = Number(p[0].family_orientation);
      routine = Number(p[0].routine_preference);
    }
  }
  const taste =
    typeof male[0].taste === "string"
      ? (JSON.parse(male[0].taste) as Record<string, number>)
      : male[0].taste;
  return maleVector({
    age,
    taste,
    sessionStyle: male[0].session_style,
    condomPref: male[0].condom_pref,
    objectify: Number(male[0].objectify),
    novelty: Number(male[0].novelty),
    risk: Number(male[0].risk),
    budgetBand: male[0].budget_band,
    nightlife,
    familyOrientation,
    routine,
  });
}

export function rankByAttract(
  male: AttractVec,
  stalls: Profile[],
  econ?: import("@/lib/econ").EconVec | Record<EconKey, number>,
) {
  return [...stalls]
    .map((p) => {
      const a = attractiveness(male, stallVector(p));
      const score = econ ? scoreWithEcon(a, p.hourFen, econ) : a;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || (a.p.distanceM ?? 0) - (b.p.distanceM ?? 0))
    .map((row) => row.p);
}
