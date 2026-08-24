import type { Relation } from "@/lib/profiles";
import {
  CONDOMS,
  DAILY_QUOTAS,
  DEMEANORS,
  FEELS,
  HOURS_TAGS,
  IDENTITIES,
  MARRIAGES,
  MOANS,
  ORGASMS,
  PERSONAS,
  SKILLS,
  TRAVELS,
  type Listing,
} from "@/lib/listing";

/** 档案里已经有的事实。knobs 是 0–1 的旋钮，0.5 为中性，往上拧就更“能打”。 */
export type ArchiveInput = {
  age: number;
  identity: (typeof IDENTITIES)[number];
  marriage: (typeof MARRIAGES)[number];
  relation: Relation;
  heightCm?: number;
  weightKg?: number;
  cup?: string;
  knobs?: Partial<ListingScores>;
};

export type ListingScores = {
  experience: number;
  reserve: number;
  lewd: number;
  obedience: number;
  stamina: number;
  availability: number;
  youth: number;
  risk: number;
};

export type MappedListing = Pick<
  Listing,
  | "demeanor"
  | "moan"
  | "skillLevel"
  | "orgasm"
  | "feel"
  | "persona"
  | "sellingPoints"
  | "hoursTag"
  | "dailyQuota"
  | "travel"
  | "condom"
  | "reviewPref"
> & {
  scores: ListingScores;
  hourYuan: number;
  nightYuan: number;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function knob(scores: ListingScores, knobs: Partial<ListingScores> | undefined, key: keyof ListingScores) {
  const bias = ((knobs?.[key] ?? 0.5) - 0.5) * 0.5;
  return clamp01(scores[key] + bias);
}

function pick<T extends string>(score: number, rungs: readonly T[]): T {
  const i = Math.min(rungs.length - 1, Math.max(0, Math.floor(score * rungs.length - 1e-9)));
  return rungs[i] ?? rungs[0];
}

/**
 * 各轴怎么来（年龄只是其中一条，不是唯一）：
 * - experience 床技：岁数、婚育、关系里当过伴侣的（妻子/母亲）、自由职业时间多
 * - reserve 生涩：女儿/兄妹/母亲更高；女友、朋友更低
 * - lewd 放得开：和 reserve 对冲，再加职业、女友
 * - obedience 听话/奴性：对主人的从属。母亲、妻子、女儿高，同事低
 * - stamina 体力：年轻、偏瘦
 * - availability 能接：自由职业全天，在校周末晚，在职晚上
 * - youth 年轻体感：岁数越低越高，卖点走紧、白虎
 * - risk 无套意愿：放得开 + 奴性，在校往下压
 */
export function scoreArchive(input: ArchiveInput): ListingScores {
  const age = Number.isFinite(input.age) ? input.age : 24;
  const age01 = clamp01((age - 18) / 27);
  const youth = clamp01(1 - (age - 18) / 22);

  let experience = 0.12 + age01 * 0.5;
  if (input.marriage === "已婚已育") experience += 0.16;
  else if (input.marriage === "已婚未育") experience += 0.08;
  if (input.relation === "母亲") experience += 0.1;
  else if (input.relation === "妻子") experience += 0.12;
  else if (input.relation === "女友") experience += 0.05;
  else if (input.relation === "女儿" || input.relation === "兄妹") experience -= 0.08;
  if (input.identity === "自由职业") experience += 0.06;
  if (input.identity === "在校（仅18+）") experience -= 0.06;

  let reserve = 0.35;
  if (input.relation === "女儿" || input.relation === "兄妹") reserve += 0.28;
  else if (input.relation === "母亲") reserve += 0.18;
  else if (input.relation === "妻子") reserve += 0.08;
  else if (input.relation === "女友") reserve -= 0.08;
  else if (input.relation === "朋友") reserve -= 0.12;
  else if (input.relation === "同事") reserve -= 0.04;
  if (input.marriage === "未婚未育") reserve += 0.08;
  if (input.identity === "在校（仅18+）") reserve += 0.08;
  reserve += (1 - age01) * 0.1;

  let lewd = 0.22 + (1 - reserve) * 0.35 + age01 * 0.12;
  if (input.relation === "女友") lewd += 0.16;
  else if (input.relation === "朋友") lewd += 0.1;
  else if (input.relation === "妻子") lewd += 0.06;
  if (input.identity === "自由职业") lewd += 0.1;

  let obedience = 0.28;
  if (input.relation === "母亲") obedience += 0.28;
  else if (input.relation === "妻子") obedience += 0.22;
  else if (input.relation === "女儿") obedience += 0.18;
  else if (input.relation === "兄妹") obedience += 0.14;
  else if (input.relation === "女友") obedience += 0.08;
  else if (input.relation === "朋友") obedience += 0.02;
  else if (input.relation === "同事") obedience -= 0.06;
  obedience += age01 * 0.08;

  let stamina = 0.35 + youth * 0.5;
  if (input.identity === "在校（仅18+）") stamina += 0.08;
  if (input.weightKg && input.heightCm) {
    const bmi = input.weightKg / (input.heightCm / 100) ** 2;
    if (bmi < 19) stamina += 0.05;
    if (bmi > 24) stamina -= 0.08;
  }

  let availability = 0.3;
  if (input.identity === "自由职业") availability += 0.4;
  else if (input.identity === "在校（仅18+）") availability += 0.12;
  else availability += 0.05;
  if (input.relation === "女友" || input.relation === "朋友") availability += 0.08;
  if (input.relation === "母亲" || input.relation === "妻子") availability -= 0.04;

  let risk = lewd * 0.45 + obedience * 0.25 + age01 * 0.15;
  if (input.identity === "在校（仅18+）") risk -= 0.12;
  if (input.marriage === "已婚已育") risk += 0.06;

  const raw: ListingScores = {
    experience: clamp01(experience),
    reserve: clamp01(reserve),
    lewd: clamp01(lewd),
    obedience: clamp01(obedience),
    stamina: clamp01(stamina),
    availability: clamp01(availability),
    youth: clamp01(youth),
    risk: clamp01(risk),
  };
  return {
    experience: knob(raw, input.knobs, "experience"),
    reserve: knob(raw, input.knobs, "reserve"),
    lewd: knob(raw, input.knobs, "lewd"),
    obedience: knob(raw, input.knobs, "obedience"),
    stamina: knob(raw, input.knobs, "stamina"),
    availability: knob(raw, input.knobs, "availability"),
    youth: knob(raw, input.knobs, "youth"),
    risk: knob(raw, input.knobs, "risk"),
  };
}

function sellingPoints(input: ArchiveInput, s: ListingScores): string[] {
  const ranked: { name: string; w: number }[] = [
    { name: "反差", w: s.reserve * 0.6 + (input.relation === "母亲" || input.relation === "妻子" ? 0.35 : 0.1) },
    { name: "气质反差", w: s.reserve * 0.5 + s.obedience * 0.3 },
    { name: "奴性强", w: s.obedience },
    { name: "逼紧", w: s.youth * 0.8 + (input.marriage === "未婚未育" ? 0.2 : 0) },
    { name: "馒头逼", w: s.youth * 0.45 },
    { name: "无毛白虎", w: s.youth * 0.35 },
    { name: "易高潮", w: (1 - s.reserve) * 0.4 + s.lewd * 0.4 },
    { name: "潮喷", w: s.lewd * 0.35 + s.experience * 0.25 },
    { name: "体力好耐操", w: s.stamina },
    { name: "全自动", w: s.lewd * 0.4 + s.obedience * 0.4 },
    { name: "口活儿出众", w: s.experience * 0.55 + s.obedience * 0.2 },
    { name: "技术好活儿好", w: s.experience },
    { name: "淫语", w: s.lewd * 0.7 },
    { name: "身材好", w: s.youth * 0.3 + 0.2 },
    { name: "皮肤好", w: s.youth * 0.4 },
    { name: "长腿美足", w: (input.heightCm ?? 160) >= 168 ? 0.55 : 0.15 },
    { name: "巨乳", w: input.cup === "E" ? 0.9 : input.cup === "D" ? 0.65 : input.cup === "C" ? 0.25 : 0.05 },
    { name: "美臀", w: input.weightKg && input.weightKg >= 52 ? 0.4 : 0.2 },
    { name: "高颜值", w: s.youth * 0.35 + 0.2 },
    { name: "特殊职业身份", w: input.identity === "在校（仅18+）" || input.relation === "母亲" ? 0.55 : 0.1 },
  ];
  return ranked
    .sort((a, b) => b.w - a.w)
    .slice(0, 5)
    .map((x) => x.name);
}

export function listingFromArchive(input: ArchiveInput): MappedListing {
  const s = scoreArchive(input);
  const show = s.lewd * 0.55 + (1 - s.reserve) * 0.45;
  const hours = input.identity === "自由职业"
    ? pick(s.availability, ["仅晚上可接", "全天可接", "全天可接"] as const)
    : input.identity === "在校（仅18+）"
      ? pick(s.availability, ["仅周末可接", "仅晚上可接", "仅晚上可接"] as const)
      : pick(s.availability, ["仅晚上可接", "仅晚上可接", "仅工作日可接"] as const);
  const hourYuan = Math.round(4 + s.experience * 10 + s.obedience * 4 + (input.relation === "母亲" || input.relation === "女儿" ? 3 : 0));
  return {
    scores: s,
    demeanor: pick(show, DEMEANORS),
    moan: pick(s.lewd, MOANS),
    skillLevel: pick(s.experience, SKILLS),
    orgasm: pick(s.experience * 0.45 + s.lewd * 0.35 + s.youth * 0.2, ORGASMS),
    feel: pick(s.lewd * 0.5 + s.experience * 0.5, FEELS),
    persona: pick(s.lewd * 0.5 + s.obedience * 0.2 + (1 - s.reserve) * 0.3, PERSONAS),
    sellingPoints: sellingPoints(input, s),
    hoursTag: (HOURS_TAGS as readonly string[]).includes(hours) ? (hours as (typeof HOURS_TAGS)[number]) : "仅晚上可接",
    dailyQuota: pick(s.availability * 0.6 + s.stamina * 0.4, DAILY_QUOTAS),
    travel: pick(s.availability, TRAVELS),
    condom: pick(s.risk, CONDOMS),
    reviewPref: pick(s.obedience * 0.4 + s.availability * 0.3, ["不需要", "可以接受", "非常需要"] as const),
    hourYuan,
    nightYuan: hourYuan * 4,
  };
}
