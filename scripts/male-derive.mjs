const TASTE_KEYS = ["母亲", "妻子", "女儿", "女友", "兄妹", "朋友", "同事", "路人"];

function clamp01(n) {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}
function round2(n) {
  return Math.round(clamp01(n) * 100) / 100;
}

export function deriveMale(axes, owned, extra = {}) {
  const a = {
    sociability: clamp01(axes.sociability),
    routine: clamp01(axes.routine_preference),
    spontaneity: clamp01(axes.spontaneity),
    nightlife: clamp01(axes.nightlife_preference),
    budget: clamp01(axes.activity_budget),
    family: clamp01(axes.family_orientation),
    warmth: clamp01(axes.warmth),
    directness: clamp01(axes.directness),
  };
  const taste = Object.fromEntries(TASTE_KEYS.map((k) => [k, 0]));
  taste.母亲 += a.family * 0.55;
  taste.妻子 += a.family * 0.5;
  taste.女儿 += a.family * 0.35;
  const status = extra.familyStatus ?? "";
  if (status.includes("未成年")) taste.女儿 += 0.42;
  else if (status.includes("成年孩子")) taste.女儿 += 0.25;
  if ((extra.age ?? 0) >= 35) taste.母亲 += a.family * 0.25;
  taste.女友 += a.nightlife * 0.45 + a.sociability * 0.15;
  taste.路人 += (1 - a.family) * 0.35 + a.spontaneity * 0.25 + a.sociability * 0.15;
  taste.朋友 += a.sociability * 0.25;
  taste.同事 += (1 - a.family) * 0.1;
  const familyOwned = (owned.母亲 ?? 0) + (owned.妻子 ?? 0) + (owned.女儿 ?? 0);
  if ((owned.母亲 ?? 0) > 0) taste.母亲 = Math.max(taste.母亲, 0.92);
  if ((owned.妻子 ?? 0) > 0) taste.妻子 = Math.max(taste.妻子, 0.88);
  if ((owned.女儿 ?? 0) > 0) taste.女儿 = Math.max(taste.女儿, 0.9);
  if (familyOwned > 0) taste.女友 *= 0.35;
  for (const key of TASTE_KEYS) {
    if (key === "母亲" || key === "妻子" || key === "女儿") continue;
    const n = owned[key] ?? 0;
    if (n > 0) taste[key] += Math.min(0.7, 0.28 + n * 0.12);
  }
  for (const key of TASTE_KEYS) taste[key] = round2(taste[key]);

  let session_style = "快餐灌注";
  if (a.family > 0.55 && a.routine > 0.5) session_style = "包厕";
  else if (a.warmth > 0.55 && a.nightlife < 0.55) session_style = "过夜";

  const risk = round2(a.nightlife * 0.35 + (1 - a.family) * 0.3 + a.spontaneity * 0.25);
  const objectify = round2(0.3 + (1 - a.warmth) * 0.4 + a.directness * 0.25);
  const novelty = round2(a.spontaneity * 0.55 + (1 - a.routine) * 0.4);

  let condom_pref = "看货";
  if (risk > 0.62 && objectify > 0.55) condom_pref = "无套优先";
  else if (risk < 0.32 && a.family > 0.5) condom_pref = "必须套";

  const budget_band = a.budget < 0.34 ? "低" : a.budget < 0.66 ? "中" : "高";
  return { taste, session_style, condom_pref, objectify, novelty, risk, budget_band };
}

export function deriveEcon(derived, axes) {
  const tight = derived.budget_band === "低" ? 0.85 : derived.budget_band === "高" ? 0.12 : 0.42;
  const cash_tight = round2(tight * 0.7 + (1 - clamp01(axes.activity_budget)) * 0.3);
  const bargain = round2(cash_tight * 0.55 + (1 - derived.risk) * 0.25 + derived.novelty * 0.1);
  const flip = round2(derived.novelty * 0.6 + clamp01(axes.spontaneity) * 0.4);
  const hold = round2(clamp01(axes.routine_preference) * 0.55 + (derived.session_style === "包厕" ? 0.4 : 0.1));
  const rent = round2((derived.session_style === "快餐灌注" ? 0.55 : 0.15) + cash_tight * 0.35);
  const prestige = round2((1 - cash_tight) * 0.5 + derived.objectify * 0.35);
  const family_liquidate = round2(clamp01(axes.family_orientation) * 0.4 + derived.objectify * 0.4 + flip * 0.2);
  const use_over_own = round2(rent * 0.65 + (1 - hold) * 0.35);
  return { cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own };
}
