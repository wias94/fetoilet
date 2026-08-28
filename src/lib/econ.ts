import type { Sql } from "@/lib/db";
import type { BudgetBand, SessionStyle } from "@/lib/male-params";
import type { Profile } from "@/lib/profiles";

/** 经济观。从已有文本/轴数字化，不替换原表。影响点单排序、挂牌价、买不买。 */
export const ECON_KEYS = [
  "cash_tight",
  "bargain",
  "flip",
  "hold",
  "rent",
  "prestige",
  "family_liquidate",
  "use_over_own",
] as const;

export type EconKey = (typeof ECON_KEYS)[number];
export type EconVec = number[];

export type EconInput = {
  budgetBand: BudgetBand | string;
  activityBudget: number;
  novelty: number;
  spontaneity: number;
  routine: number;
  risk: number;
  objectify: number;
  familyOrientation: number;
  sessionStyle: SessionStyle | string;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function round2(n: number) {
  return Math.round(clamp01(n) * 100) / 100;
}

export function deriveEcon(m: EconInput): Record<EconKey, number> {
  const tight =
    m.budgetBand === "低" ? 0.85 : m.budgetBand === "高" ? 0.12 : 0.42;
  const cash_tight = round2(tight * 0.7 + (1 - clamp01(m.activityBudget)) * 0.3);
  const bargain = round2(cash_tight * 0.55 + (1 - clamp01(m.risk)) * 0.25 + clamp01(m.novelty) * 0.1);
  const flip = round2(clamp01(m.novelty) * 0.6 + clamp01(m.spontaneity) * 0.4);
  const hold = round2(clamp01(m.routine) * 0.55 + (m.sessionStyle === "包厕" ? 0.4 : 0.1));
  const rent = round2((m.sessionStyle === "快餐灌注" ? 0.55 : 0.15) + cash_tight * 0.35);
  const prestige = round2((1 - cash_tight) * 0.5 + clamp01(m.objectify) * 0.35);
  const family_liquidate = round2(clamp01(m.familyOrientation) * 0.4 + clamp01(m.objectify) * 0.4 + flip * 0.2);
  const use_over_own = round2(rent * 0.65 + (1 - hold) * 0.35);
  return { cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own };
}

export function econVector(m: EconInput): EconVec {
  const d = deriveEcon(m);
  return ECON_KEYS.map((k) => d[k]);
}

export function defaultEconInput(): EconInput {
  return {
    budgetBand: "中",
    activityBudget: 0.5,
    novelty: 0.45,
    spontaneity: 0.4,
    routine: 0.45,
    risk: 0.35,
    objectify: 0.55,
    familyOrientation: 0.3,
    sessionStyle: "快餐灌注",
  };
}

/** 能赚就贵，没人用就贱。 */
export function earnMultiplier(used7: number, usedAll: number, weeksHeld: number) {
  if (used7 >= 6) return 1.45;
  if (used7 >= 3) return 1.25;
  if (used7 >= 1) return 1.05;
  if (usedAll <= 0) return 0.48;
  if (weeksHeld >= 2) return 0.55;
  return 0.72;
}

export function suggestListFen(
  p: Profile,
  usage?: { used7?: number; usedAll?: number },
) {
  const weeks = p.holdWeeks ?? 0;
  const share = (p.ownerSharePct ?? 100) / 100;
  const family = ["母亲", "妻子", "女儿", "兄妹"].includes(p.relation ?? "");
  const saleShare = family ? 1 : share;
  let uses = 16 * saleShare;
  if (!family) uses *= Math.max(0.45, 1 - weeks * 0.08);
  uses *= earnMultiplier(usage?.used7 ?? 0, usage?.usedAll ?? 0, weeks);
  const fen = Math.round((p.hourFen * uses) / 100) * 100;
  const lo = p.hourFen * (family ? 8 : 5);
  const hi = p.hourFen * (family ? 40 : 36);
  return Math.max(lo, Math.min(hi, Math.max(100, fen)));
}

export function wouldBuy(opts: {
  score: number;
  hourFen: number;
  listedFen: number;
  walletFen?: number | null;
  econ?: Record<EconKey, number> | EconVec;
  minScore?: number;
}) {
  const minScore = opts.minScore ?? 0.2;
  if (opts.score < minScore || opts.listedFen <= 0) return false;
  if (opts.walletFen != null && opts.listedFen > opts.walletFen) return false;
  const e = vecToEcon(opts.econ);
  if (e.use_over_own > 0.7 && opts.listedFen > opts.hourFen * 14) return false;
  let fair = opts.hourFen * (8 + 40 * opts.score);
  fair *= 1 + e.prestige * 0.2;
  const need = fair * (0.7 + 0.3 * (1 - e.bargain));
  if (e.cash_tight > 0.65 && opts.walletFen != null && opts.listedFen > opts.walletFen * 0.45) {
    return false;
  }
  return opts.listedFen <= need * 1.05;
}

function vecToEcon(v?: Record<EconKey, number> | EconVec): Record<EconKey, number> {
  if (!v) return deriveEcon(defaultEconInput());
  if (Array.isArray(v)) {
    const o = deriveEcon(defaultEconInput());
    ECON_KEYS.forEach((k, i) => {
      o[k] = v[i] ?? o[k];
    });
    return o;
  }
  return v;
}

export function scoreWithEcon(attract: number, hourFen: number, econ: EconVec | Record<EconKey, number>) {
  const e = vecToEcon(econ);
  const price = clamp01((hourFen - 200) / 1800);
  let s = attract;
  s *= 1 - e.cash_tight * 0.4 * price;
  s *= 1 + e.prestige * 0.18 * price;
  s *= 1 - e.rent * 0.08;
  return clamp01(s);
}

export async function loadMaleEcon(sql: Sql, userId: string): Promise<Record<EconKey, number>> {
  const stored = await sql<Record<EconKey, number> & { user_id: string }>`
    select cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own
    from behavior_econ where user_id = ${userId} limit 1
  `;
  if (stored[0]) {
    return {
      cash_tight: Number(stored[0].cash_tight),
      bargain: Number(stored[0].bargain),
      flip: Number(stored[0].flip),
      hold: Number(stored[0].hold),
      rent: Number(stored[0].rent),
      prestige: Number(stored[0].prestige),
      family_liquidate: Number(stored[0].family_liquidate),
      use_over_own: Number(stored[0].use_over_own),
    };
  }
  const male = await sql<{
    budget_band: string;
    novelty: number;
    risk: number;
    objectify: number;
    session_style: string;
    person_id: string | null;
  }>`
    select budget_band, novelty, risk, objectify, session_style, person_id
    from behavior_male where user_id = ${userId} limit 1
  `;
  if (!male[0]) return deriveEcon(defaultEconInput());
  let activityBudget = 0.5;
  let novelty = Number(male[0].novelty);
  let spontaneity = 0.4;
  let routine = 0.45;
  let familyOrientation = 0.3;
  if (male[0].person_id) {
    const p = await sql<{
      activity_budget: number;
      spontaneity: number;
      routine_preference: number;
      family_orientation: number;
    }>`
      select activity_budget, spontaneity, routine_preference, family_orientation
      from behavior_person where person_id = ${male[0].person_id} limit 1
    `;
    if (p[0]) {
      activityBudget = Number(p[0].activity_budget);
      spontaneity = Number(p[0].spontaneity);
      routine = Number(p[0].routine_preference);
      familyOrientation = Number(p[0].family_orientation);
    }
  }
  return deriveEcon({
    budgetBand: male[0].budget_band,
    activityBudget,
    novelty,
    spontaneity,
    routine,
    risk: Number(male[0].risk),
    objectify: Number(male[0].objectify),
    familyOrientation,
    sessionStyle: male[0].session_style,
  });
}

export async function stallUsage(sql: Sql, ids: string[]) {
  const out = new Map<string, { used7: number; usedAll: number }>();
  if (!ids.length) return out;
  const rows = await sql.query<{ id: string; used7: number; used_all: number }>(
    `select
      profile_id as id,
      count(*) filter (
        where coalesce(status, 'pending') = 'used'
          and coalesce(updated_at, created_at) >= now() - interval '7 days'
      )::int as used7,
      count(*) filter (where coalesce(status, 'pending') = 'used')::int as used_all
    from inquiries
    where profile_id = any($1::text[])
    group by profile_id`,
    [ids],
  );
  for (const r of rows) out.set(r.id, { used7: Number(r.used7), usedAll: Number(r.used_all) });
  return out;
}
