import type { Sql } from "@/lib/db";

/** 档案文字 → 轴 0–1。程度从低到高排。 */
export const TEXT_SCALE_SEED: { field: string; option: string; axis: string; value: number }[] = [
  { field: "cup", option: "B", axis: "chest", value: 0.35 },
  { field: "cup", option: "C", axis: "chest", value: 0.55 },
  { field: "cup", option: "D", axis: "chest", value: 0.78 },
  { field: "cup", option: "E", axis: "chest", value: 1 },

  { field: "demeanor", option: "被动保守呆板生涩", axis: "lewd", value: 0.08 },
  { field: "demeanor", option: "羞涩需要引导鼓励", axis: "lewd", value: 0.28 },
  { field: "demeanor", option: "自然开放积极配合", axis: "lewd", value: 0.5 },
  { field: "demeanor", option: "风骚风情诱人魅惑", axis: "lewd", value: 0.72 },
  { field: "demeanor", option: "主动豪放热情放荡", axis: "lewd", value: 0.88 },
  { field: "demeanor", option: "卑微下贱无脑淫痴", axis: "lewd", value: 1 },

  { field: "persona", option: "有待开发的良家", axis: "lewd", value: 0.12 },
  { field: "persona", option: "反差装逼的婊子", axis: "lewd", value: 0.42 },
  { field: "persona", option: "风情万种的骚货", axis: "lewd", value: 0.62 },
  { field: "persona", option: "淫荡风骚的荡妇", axis: "lewd", value: 0.82 },
  { field: "persona", option: "欠操下贱的母狗", axis: "lewd", value: 0.95 },
  { field: "persona", option: "专业熟练的妓女", axis: "lewd", value: 0.78 },
  { field: "persona", option: "有待开发的良家", axis: "obedient", value: 0.35 },
  { field: "persona", option: "反差装逼的婊子", axis: "obedient", value: 0.28 },
  { field: "persona", option: "风情万种的骚货", axis: "obedient", value: 0.4 },
  { field: "persona", option: "淫荡风骚的荡妇", axis: "obedient", value: 0.55 },
  { field: "persona", option: "欠操下贱的母狗", axis: "obedient", value: 1 },
  { field: "persona", option: "专业熟练的妓女", axis: "obedient", value: 0.7 },

  { field: "personality", option: "清高要强", axis: "obedient", value: 0.12 },
  { field: "personality", option: "作精骄纵", axis: "obedient", value: 0.18 },
  { field: "personality", option: "冷淡疏离", axis: "obedient", value: 0.22 },
  { field: "personality", option: "外向热闹", axis: "obedient", value: 0.4 },
  { field: "personality", option: "内向闷骚", axis: "obedient", value: 0.48 },
  { field: "personality", option: "软萌粘人", axis: "obedient", value: 0.7 },
  { field: "personality", option: "隐忍顾家", axis: "obedient", value: 0.82 },
  { field: "personality", option: "温顺讨好", axis: "obedient", value: 0.92 },

  { field: "moan", option: "不吭声没动静", axis: "lewd", value: 0.1 },
  { field: "moan", option: "只会轻喘呻吟", axis: "lewd", value: 0.4 },
  { field: "moan", option: "叫声大叫的骚", axis: "lewd", value: 0.75 },
  { field: "moan", option: "淫语骚话不停", axis: "lewd", value: 1 },

  { field: "skill", option: "入门基础级", axis: "skill", value: 0.15 },
  { field: "skill", option: "常规伴侣级", axis: "skill", value: 0.4 },
  { field: "skill", option: "优质情人级", axis: "skill", value: 0.7 },
  { field: "skill", option: "专业技师级", axis: "skill", value: 1 },

  { field: "orgasm", option: "从未高潮", axis: "lewd", value: 0.12 },
  { field: "orgasm", option: "不易高潮", axis: "lewd", value: 0.28 },
  { field: "orgasm", option: "很难把握", axis: "lewd", value: 0.4 },
  { field: "orgasm", option: "正常可以高潮", axis: "lewd", value: 0.55 },
  { field: "orgasm", option: "很容易高潮", axis: "lewd", value: 0.78 },
  { field: "orgasm", option: "可以多次连续高潮", axis: "lewd", value: 1 },

  { field: "feel", option: "纯粹泄欲", axis: "lewd", value: 0.25 },
  { field: "feel", option: "愉悦身心", axis: "lewd", value: 0.45 },
  { field: "feel", option: "绝顶肉体", axis: "lewd", value: 0.7 },
  { field: "feel", option: "荡妇享受", axis: "lewd", value: 0.88 },
  { field: "feel", option: "大开眼界", axis: "lewd", value: 0.95 },

  { field: "condom", option: "必须带套", axis: "bare", value: 0.05 },
  { field: "condom", option: "看人可无套", axis: "bare", value: 0.45 },
  { field: "condom", option: "加钱可无套", axis: "bare", value: 0.7 },
  { field: "condom", option: "均可无套", axis: "bare", value: 1 },

  { field: "hours", option: "仅白天可接", axis: "nightlife", value: 0.1 },
  { field: "hours", option: "仅工作日可接", axis: "nightlife", value: 0.2 },
  { field: "hours", option: "仅周末可接", axis: "nightlife", value: 0.35 },
  { field: "hours", option: "全天可接", axis: "nightlife", value: 0.55 },
  { field: "hours", option: "仅晚上可接", axis: "nightlife", value: 1 },
  { field: "hours", option: "全天可接", axis: "session_fast", value: 0.9 },
  { field: "hours", option: "仅晚上可接", axis: "session_fast", value: 0.45 },
  { field: "hours", option: "仅白天可接", axis: "session_fast", value: 0.4 },

  { field: "quota", option: "一天一客", axis: "session_keep", value: 1 },
  { field: "quota", option: "一天两客", axis: "session_keep", value: 0.55 },
  { field: "quota", option: "一天三客", axis: "session_keep", value: 0.3 },
  { field: "quota", option: "不限", axis: "session_keep", value: 0.1 },
  { field: "quota", option: "不限", axis: "session_fast", value: 0.95 },

  { field: "point", option: "巨乳", axis: "chest", value: 0.92 },
  { field: "point", option: "高颜值", axis: "looks", value: 0.85 },
  { field: "point", option: "美臀", axis: "looks", value: 0.55 },
  { field: "point", option: "身材好", axis: "looks", value: 0.6 },
  { field: "point", option: "皮肤好", axis: "looks", value: 0.4 },
  { field: "point", option: "长腿美足", axis: "looks", value: 0.5 },
  { field: "point", option: "气质反差", axis: "looks", value: 0.45 },
];

export type TextScaleMap = Map<string, number>;

function key(field: string, option: string, axis: string) {
  return `${field}\t${option}\t${axis}`;
}

function fromRows(rows: { field: string; option: string; axis: string; value: number }[]): TextScaleMap {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r.field, r.option, r.axis), r.value);
  return map;
}

let cache: { at: number; map: TextScaleMap } | null = null;

export function defaultTextScale(): TextScaleMap {
  return fromRows(TEXT_SCALE_SEED);
}

export function currentTextScale(): TextScaleMap {
  return cache?.map ?? defaultTextScale();
}

export async function loadTextScale(sql?: Sql): Promise<TextScaleMap> {
  if (cache && Date.now() - cache.at < 8000) return cache.map;
  try {
    const db: Sql = sql ?? (await (await import("@/lib/db")).getSql());
    let rows = await db<{ field: string; option: string; axis: string; value: number }>`
      select field, option, axis, value from text_scale
    `;
    if (!rows.length) {
      for (const r of TEXT_SCALE_SEED) {
        await db`
          insert into text_scale (field, option, axis, value)
          values (${r.field}, ${r.option}, ${r.axis}, ${r.value})
          on conflict (field, option, axis) do nothing
        `;
      }
      rows = await db`select field, option, axis, value from text_scale`;
    }
    const map = rows.length ? fromRows(rows.map((r) => ({ ...r, value: Number(r.value) }))) : defaultTextScale();
    cache = { at: Date.now(), map };
    return map;
  } catch {
    const map = defaultTextScale();
    cache = { at: Date.now(), map };
    return map;
  }
}

export function scaleOf(map: TextScaleMap, field: string, option: string | null | undefined, axis: string, fallback = 0) {
  if (!option) return fallback;
  const n = map.get(key(field, option, axis));
  return n == null ? fallback : n;
}

export function meanScale(map: TextScaleMap, pairs: [string, string | null | undefined][], axis: string, fallback = 0) {
  const vals = pairs.map(([field, option]) => scaleOf(map, field, option, axis, NaN)).filter((n) => Number.isFinite(n));
  if (!vals.length) return fallback;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

export function maxScale(map: TextScaleMap, field: string, options: string[], axis: string, fallback = 0) {
  let m = fallback;
  for (const option of options) {
    const n = scaleOf(map, field, option, axis, NaN);
    if (Number.isFinite(n) && n > m) m = n;
  }
  return m;
}
