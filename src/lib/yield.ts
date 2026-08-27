export const PLATFORM_ID = "platform";

export const FAMILY_RELATIONS = ["母亲", "妻子", "女儿", "兄妹"] as const;

export type HoldingCut = {
  weeks: number;
  family: boolean;
  ownerSharePct: number;
  platformSharePct: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function holdingWeeks(ownedAt: string | Date | null | undefined, now = new Date()) {
  if (!ownedAt) return 0;
  const t = ownedAt instanceof Date ? ownedAt.getTime() : Date.parse(ownedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / WEEK_MS));
}

export function isFamilyRelation(relation: string | null | undefined) {
  return (FAMILY_RELATIONS as readonly string[]).includes(relation ?? "");
}

/** 满一周起扣。外人每周 10% 到 50%；家人每周 20% 到 80%。 */
export function holdingCut(
  relation: string | null | undefined,
  ownedAt: string | Date | null | undefined,
  now = new Date(),
): HoldingCut {
  const weeks = holdingWeeks(ownedAt, now);
  const family = isFamilyRelation(relation);
  const step = family ? 20 : 10;
  const cap = family ? 80 : 50;
  const platformSharePct = Math.min(cap, step * weeks);
  return {
    weeks,
    family,
    ownerSharePct: 100 - platformSharePct,
    platformSharePct,
  };
}

export function splitFen(gross: number, cut: HoldingCut) {
  const g = Math.max(0, Math.floor(gross));
  const ownerFen = Math.floor((g * cut.ownerSharePct) / 100);
  return { ownerFen, platformFen: g - ownerFen };
}
