import type { Relation } from "@/lib/profiles";
import {
  CONDOMS,
  DAILY_QUOTAS,
  DEMEANORS,
  FEELS,
  HOURS_TAGS,
  IDENTITIES,
  JOBS,
  MARRIAGES,
  MOANS,
  ORGASMS,
  PERSONALITIES,
  PERSONAS,
  SKILLS,
  TRAVELS,
  type Listing,
} from "@/lib/listing";

export type ScoreKey =
  | "experience"
  | "reserve"
  | "lewd"
  | "obedience"
  | "stamina"
  | "availability"
  | "youth"
  | "risk"
  | "temper"
  | "post";

export type ListingScores = Record<ScoreKey, number>;

/** 档案事实。knobs 0–1，0.5 中性。temper=性格轴（讨好/顺从），post=职位轴（暴露/可被用）。 */
export type ArchiveInput = {
  age: number;
  identity: (typeof IDENTITIES)[number];
  job?: (typeof JOBS)[number];
  personality?: (typeof PERSONALITIES)[number];
  marriage: (typeof MARRIAGES)[number];
  relation: Relation;
  heightCm?: number;
  weightKg?: number;
  cup?: string;
  knobs?: Partial<ListingScores>;
};

type Trait = Partial<
  Pick<ListingScores, "experience" | "reserve" | "lewd" | "obedience" | "stamina" | "availability" | "risk" | "temper" | "post" | "youth">
>;

const PERSONALITY_TRAIT: Record<(typeof PERSONALITIES)[number], Trait> = {
  温顺讨好: { temper: 0.82, obedience: 0.18, reserve: 0.08, lewd: -0.04 },
  软萌粘人: { temper: 0.7, obedience: 0.12, stamina: 0.06, lewd: 0.04 },
  内向闷骚: { temper: 0.45, reserve: 0.16, lewd: 0.14, obedience: 0.04 },
  清高要强: { temper: 0.18, reserve: 0.14, obedience: -0.16, lewd: -0.1 },
  冷淡疏离: { temper: 0.22, reserve: 0.18, lewd: -0.12, obedience: -0.1, availability: -0.08 },
  外向热闹: { temper: 0.48, lewd: 0.12, reserve: -0.12, availability: 0.1 },
  作精骄纵: { temper: 0.12, lewd: 0.16, obedience: -0.18, reserve: -0.1 },
  隐忍顾家: { temper: 0.78, obedience: 0.2, reserve: 0.12, availability: -0.06, lewd: -0.06 },
};

const JOB_TRAIT: Record<(typeof JOBS)[number], Trait & { identity: (typeof IDENTITIES)[number] }> = {
  在校学生: { identity: "在校（仅18+）", post: 0.2, experience: -0.08, youth: 0.08, availability: 0.08, risk: -0.1, reserve: 0.08 },
  全职主妇: { identity: "自由职业", post: 0.35, availability: 0.22, experience: 0.06, obedience: 0.08, reserve: 0.06 },
  公司职员: { identity: "在职", post: 0.4, availability: 0.02 },
  教师: { identity: "在职", post: 0.72, reserve: 0.14, risk: -0.08, lewd: -0.04 },
  护士: { identity: "在职", post: 0.62, stamina: 0.1, experience: 0.06, availability: 0.08 },
  服务员: { identity: "在职", post: 0.55, stamina: 0.08, lewd: 0.06, availability: 0.1 },
  销售: { identity: "在职", post: 0.58, lewd: 0.08, availability: 0.12, reserve: -0.06 },
  公务员: { identity: "在职", post: 0.78, reserve: 0.16, risk: -0.1, availability: -0.04 },
  主播网红: { identity: "自由职业", post: 0.85, lewd: 0.16, availability: 0.2, reserve: -0.12 },
  无业: { identity: "自由职业", post: 0.28, availability: 0.24, experience: -0.04 },
};

export function identityFromJob(job: (typeof JOBS)[number]): (typeof IDENTITIES)[number] {
  return JOB_TRAIT[job].identity;
}

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
  | "identity"
  | "job"
  | "personality"
> & {
  scores: ListingScores;
  hourYuan: number;
  nightYuan: number;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function knob(scores: ListingScores, knobs: Partial<ListingScores> | undefined, key: ScoreKey) {
  const bias = ((knobs?.[key] ?? 0.5) - 0.5) * 0.5;
  return clamp01(scores[key] + bias);
}

function pick<T extends string>(score: number, rungs: readonly T[]): T {
  const i = Math.min(rungs.length - 1, Math.max(0, Math.floor(score * rungs.length - 1e-9)));
  return rungs[i] ?? rungs[0];
}

function addTrait(s: ListingScores, t: Trait | undefined) {
  if (!t) return;
  for (const [k, v] of Object.entries(t)) {
    if (k === "identity" || v == null) continue;
    const key = k as ScoreKey;
    if (key in s) s[key] = clamp01(s[key] + v);
  }
}

export function scoreArchive(input: ArchiveInput): ListingScores {
  const age = Number.isFinite(input.age) ? input.age : 24;
  const age01 = clamp01((age - 18) / 27);
  const youth = clamp01(1 - (age - 18) / 22);
  const job = input.job ?? "公司职员";
  const personality = input.personality ?? "温顺讨好";
  const jobTrait = JOB_TRAIT[job];
  const identity = input.identity || jobTrait.identity;

  let experience = 0.12 + age01 * 0.5;
  if (input.marriage === "已婚已育") experience += 0.16;
  else if (input.marriage === "已婚未育") experience += 0.08;
  if (input.relation === "母亲") experience += 0.1;
  else if (input.relation === "妻子") experience += 0.12;
  else if (input.relation === "女友") experience += 0.05;
  else if (input.relation === "女儿" || input.relation === "兄妹") experience -= 0.08;
  if (identity === "自由职业") experience += 0.06;
  if (identity === "在校（仅18+）") experience -= 0.06;

  let reserve = 0.35;
  if (input.relation === "女儿" || input.relation === "兄妹") reserve += 0.28;
  else if (input.relation === "母亲") reserve += 0.18;
  else if (input.relation === "妻子") reserve += 0.08;
  else if (input.relation === "女友") reserve -= 0.08;
  else if (input.relation === "朋友") reserve -= 0.12;
  else if (input.relation === "同事") reserve -= 0.04;
  if (input.marriage === "未婚未育") reserve += 0.08;
  if (identity === "在校（仅18+）") reserve += 0.08;
  reserve += (1 - age01) * 0.1;

  let lewd = 0.22 + (1 - reserve) * 0.35 + age01 * 0.12;
  if (input.relation === "女友") lewd += 0.16;
  else if (input.relation === "朋友") lewd += 0.1;
  else if (input.relation === "妻子") lewd += 0.06;
  if (identity === "自由职业") lewd += 0.1;

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
  if (identity === "在校（仅18+）") stamina += 0.08;
  if (input.weightKg && input.heightCm) {
    const bmi = input.weightKg / (input.heightCm / 100) ** 2;
    if (bmi < 19) stamina += 0.05;
    if (bmi > 24) stamina -= 0.08;
  }

  let availability = 0.3;
  if (identity === "自由职业") availability += 0.4;
  else if (identity === "在校（仅18+）") availability += 0.12;
  else availability += 0.05;
  if (input.relation === "女友" || input.relation === "朋友") availability += 0.08;
  if (input.relation === "母亲" || input.relation === "妻子") availability -= 0.04;

  let risk = lewd * 0.45 + obedience * 0.25 + age01 * 0.15;
  if (identity === "在校（仅18+）") risk -= 0.12;
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
    temper: 0.5,
    post: 0.4,
  };
  addTrait(raw, PERSONALITY_TRAIT[personality]);
  addTrait(raw, jobTrait);
  const keys: ScoreKey[] = [
    "experience",
    "reserve",
    "lewd",
    "obedience",
    "stamina",
    "availability",
    "youth",
    "risk",
    "temper",
    "post",
  ];
  const out = {} as ListingScores;
  for (const k of keys) out[k] = knob(raw, input.knobs, k);
  return out;
}

function sellingPoints(input: ArchiveInput, s: ListingScores): string[] {
  const job = input.job ?? "公司职员";
  const specialJob = job === "在校学生" || job === "教师" || job === "护士" || job === "公务员" || input.relation === "母亲";
  const ranked: { name: string; w: number }[] = [
    { name: "反差", w: s.reserve * 0.4 + s.post * 0.4 + (input.relation === "母亲" || input.relation === "妻子" ? 0.2 : 0) },
    { name: "气质反差", w: s.reserve * 0.35 + s.post * 0.3 + s.temper * 0.15 },
    { name: "奴性强", w: s.obedience * 0.7 + s.temper * 0.3 },
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
    { name: "特殊职业身份", w: specialJob ? 0.7 + s.post * 0.2 : s.post * 0.2 },
  ];
  return ranked
    .sort((a, b) => b.w - a.w)
    .slice(0, 5)
    .map((x) => x.name);
}

export function listingFromArchive(input: ArchiveInput): MappedListing {
  const job = input.job ?? "公司职员";
  const personality = input.personality ?? "温顺讨好";
  const identity = input.identity || identityFromJob(job);
  const s = scoreArchive({ ...input, job, personality, identity });
  const show = s.lewd * 0.4 + (1 - s.reserve) * 0.35 + (1 - s.temper) * 0.25;
  const hours = identity === "自由职业"
    ? pick(s.availability, ["仅晚上可接", "全天可接", "全天可接"] as const)
    : identity === "在校（仅18+）"
      ? pick(s.availability, ["仅周末可接", "仅晚上可接", "仅晚上可接"] as const)
      : pick(s.availability, ["仅晚上可接", "仅晚上可接", "仅工作日可接"] as const);
  const hourYuan = Math.round(
    4 + s.experience * 8 + s.obedience * 3 + s.post * 4 + (input.relation === "母亲" || input.relation === "女儿" ? 3 : 0),
  );
  return {
    scores: s,
    identity,
    job,
    personality,
    demeanor: pick(show, DEMEANORS),
    moan: pick(s.lewd, MOANS),
    skillLevel: pick(s.experience, SKILLS),
    orgasm: pick(s.experience * 0.45 + s.lewd * 0.35 + s.youth * 0.2, ORGASMS),
    feel: pick(s.lewd * 0.5 + s.experience * 0.5, FEELS),
    persona: pick(s.lewd * 0.4 + s.obedience * 0.2 + (1 - s.reserve) * 0.2 + (1 - s.temper) * 0.2, PERSONAS),
    sellingPoints: sellingPoints({ ...input, job, personality, identity }, s),
    hoursTag: (HOURS_TAGS as readonly string[]).includes(hours) ? (hours as (typeof HOURS_TAGS)[number]) : "仅晚上可接",
    dailyQuota: pick(s.availability * 0.6 + s.stamina * 0.4, DAILY_QUOTAS),
    travel: pick(s.availability, TRAVELS),
    condom: pick(s.risk, CONDOMS),
    reviewPref: pick(s.obedience * 0.35 + s.temper * 0.25 + s.availability * 0.2, ["不需要", "可以接受", "非常需要"] as const),
    hourYuan,
    nightYuan: hourYuan * 4,
  };
}
