import { DEFAULT_SIM, type SimConfig } from "@/lib/sim-config";

export const PLATFORM_ID = "platform";
/** 平台收编的无主货：转让一口价、出租一口价（分）。 */
export const PLATFORM_SALE_FEN = 1000;
export const PLATFORM_RENT_FEN = 200;

export const FAMILY_RELATIONS = ["母亲", "妻子", "女儿", "兄妹"] as const;

export type HoldingCut = {
  weeks: number;
  family: boolean;
  ownerSharePct: number;
  platformSharePct: number;
};

export function holdingWeeks(ownedAt: string | Date | null | undefined, now = new Date()) {
  if (!ownedAt) return 0;
  const t = ownedAt instanceof Date ? ownedAt.getTime() : Date.parse(ownedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / (7 * 24 * 60 * 60 * 1000)));
}

export function isFamilyRelation(relation: string | null | undefined) {
  return (FAMILY_RELATIONS as readonly string[]).includes(relation ?? "");
}

/** 满一周起扣。步长和封顶走 sim 配置。 */
export function holdingCut(
  relation: string | null | undefined,
  ownedAt: string | Date | null | undefined,
  now = new Date(),
  cfg: Pick<SimConfig, "familyWeekCutPct" | "familyCapPct" | "otherWeekCutPct" | "otherCapPct"> = DEFAULT_SIM,
): HoldingCut {
  const weeks = holdingWeeks(ownedAt, now);
  const family = isFamilyRelation(relation);
  const step = family ? cfg.familyWeekCutPct : cfg.otherWeekCutPct;
  const cap = family ? cfg.familyCapPct : cfg.otherCapPct;
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
