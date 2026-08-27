/** 初始现金均值 x（加元）。钱包存分，1 CAD = 100 fen。 */
export const INITIAL_MEAN_CAD = 100;
export const WEALTH_SIGMA = 0.9;

function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1_000_003) / 1_000_003;
}

function gauss(a: number, b: number) {
  const u = Math.max(1e-9, a);
  const v = Math.max(1e-9, b);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 对数正态，均值 x。手头紧的偏穷，撑场面/高预算偏富，最后再拉回均值 x。 */
export function drawWealthFen(
  userId: string,
  meanCad = INITIAL_MEAN_CAD,
  bias?: { cashTight?: number; prestige?: number; budgetBand?: string },
) {
  const z = gauss(hash01(userId), hash01(userId + ":w"));
  const sigma = WEALTH_SIGMA;
  const mu = Math.log(Math.max(1, meanCad)) - (sigma * sigma) / 2;
  let cad = Math.exp(mu + sigma * z);
  const tight = bias?.cashTight ?? 0.4;
  const prestige = bias?.prestige ?? 0.4;
  const band = bias?.budgetBand ?? "中";
  cad *= 0.55 + (1 - tight) * 0.5 + prestige * 0.35;
  cad *= band === "低" ? 0.55 : band === "高" ? 1.45 : 1;
  cad = Math.max(2, cad);
  return Math.round(cad * 100);
}

export function scaleToMean(fens: number[], meanCad: number) {
  if (!fens.length) return fens;
  const avg = fens.reduce((s, n) => s + n, 0) / fens.length;
  const target = meanCad * 100;
  if (avg <= 0) return fens.map(() => Math.round(target));
  const k = target / avg;
  return fens.map((n) => Math.max(100, Math.round(n * k)));
}
