export const DEPOSITS = [
  { fen: 50000, label: "500元" },
  { fen: 100000, label: "1000元" },
  { fen: 300000, label: "3000元" },
] as const;

export const IDENTITIES = ["在校（仅18+）", "在职", "自由职业"] as const;
export const MARRIAGES = ["未婚未育", "已婚未育", "已婚已育"] as const;
export const DEMEANORS = [
  "被动保守呆板生涩",
  "羞涩需要引导鼓励",
  "自然开放积极配合",
  "风骚风情诱人魅惑",
  "主动豪放热情放荡",
  "卑微下贱无脑淫痴",
] as const;
export const MOANS = ["不吭声没动静", "只会轻喘呻吟", "叫声大叫的骚", "淫语骚话不停"] as const;
export const SKILLS = ["入门基础级", "常规伴侣级", "优质情人级", "专业技师级"] as const;
export const ORGASMS = [
  "从未高潮",
  "不易高潮",
  "很难把握",
  "正常可以高潮",
  "很容易高潮",
  "可以多次连续高潮",
] as const;
export const FEELS = ["纯粹泄欲", "愉悦身心", "绝顶肉体", "荡妇享受", "大开眼界"] as const;
export const PERSONAS = [
  "有待开发的良家",
  "反差装逼的婊子",
  "风情万种的骚货",
  "淫荡风骚的荡妇",
  "欠操下贱的母狗",
  "专业熟练的妓女",
] as const;
export const SELLING_POINTS = [
  "高颜值",
  "逼紧",
  "水多",
  "反差",
  "巨乳",
  "美臀",
  "身材好",
  "皮肤好",
  "长腿美足",
  "馒头逼",
  "无毛白虎",
  "气质反差",
  "口活儿出众",
  "技术好活儿好",
  "体力好耐操",
  "全自动",
  "易高潮",
  "潮喷",
  "淫语",
  "特殊职业身份",
  "奴性强",
] as const;
export const HOURS_TAGS = ["仅晚上可接", "仅白天可接", "全天可接", "仅周末可接", "仅工作日可接"] as const;
export const DAILY_QUOTAS = ["一天一客", "一天两客", "一天三客", "不限"] as const;
export const TRAVELS = ["本地客人", "周边可接", "全国空降"] as const;
export const CONDOMS = ["必须带套", "看人可无套", "加钱可无套", "均可无套"] as const;
export const EXTRAS = [
  "舔脚",
  "毒龙",
  "多人",
  "无套",
  "吞精",
  "内射",
  "肛交",
  "户外",
  "圣水",
  "拍照",
  "录像",
] as const;
export const REVIEW_PREFS = ["不需要", "可以接受", "非常需要"] as const;

export type Listing = {
  weightKg: number;
  identity: (typeof IDENTITIES)[number];
  marriage: (typeof MARRIAGES)[number];
  demeanor: (typeof DEMEANORS)[number];
  moan: (typeof MOANS)[number];
  skillLevel: (typeof SKILLS)[number];
  orgasm: (typeof ORGASMS)[number];
  feel: (typeof FEELS)[number];
  persona: (typeof PERSONAS)[number];
  sellingPoints: string[];
  hoursTag: (typeof HOURS_TAGS)[number];
  dailyQuota: (typeof DAILY_QUOTAS)[number];
  travel: (typeof TRAVELS)[number];
  condom: (typeof CONDOMS)[number];
  extras: string[];
  reviewPref: (typeof REVIEW_PREFS)[number];
  depositFen: number;
};

export const LISTING_DEFAULTS: Listing = {
  weightKg: 50,
  identity: "在职",
  marriage: "未婚未育",
  demeanor: "自然开放积极配合",
  moan: "只会轻喘呻吟",
  skillLevel: "常规伴侣级",
  orgasm: "正常可以高潮",
  feel: "愉悦身心",
  persona: "有待开发的良家",
  sellingPoints: [],
  hoursTag: "仅晚上可接",
  dailyQuota: "一天一客",
  travel: "本地客人",
  condom: "必须带套",
  extras: [],
  reviewPref: "可以接受",
  depositFen: 50000,
};
