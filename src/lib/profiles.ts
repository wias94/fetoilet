export type TagId = "visit" | "incall" | "night" | "parttime" | "business";

export type Profile = {
  id: string;
  name: string;
  age: number;
  heightCm: number;
  cup: string;
  tags: TagId[];
  image: string;
  online: boolean;
  hourFen: number;
  nightFen: number;
  etaMin: number;
  places: string[];
  bio: string;
  services: string[];
  work: string;
  ratingAvg: number;
  ratingCount: number;
  owned?: boolean;
  unowned?: boolean;
  listedFen?: number | null;
  relation?: string | null;
  weightKg?: number;
  identity?: string;
  job?: string;
  personality?: string;
  marriage?: string;
  demeanor?: string;
  moan?: string;
  skillLevel?: string;
  orgasm?: string;
  feel?: string;
  persona?: string;
  sellingPoints?: string[];
  hoursTag?: string;
  dailyQuota?: string;
  travel?: string;
  condom?: string;
  extras?: ExtraFee[];
  reviewPref?: string;
  depositFen?: number;
};

export const RELATIONS = ["母亲", "妻子", "女儿", "女友", "兄妹", "朋友", "同事", "其他"] as const;
export type Relation = (typeof RELATIONS)[number];

export const TAGS: { id: TagId | "all"; label: string }[] = [
  { id: "all", label: "全部在册肉厕" },
  { id: "visit", label: "上门肉厕" },
  { id: "incall", label: "定点肉厕" },
  { id: "night", label: "通宵肉厕" },
  { id: "parttime", label: "下班肉厕" },
  { id: "business", label: "随身肉厕" },
];

export const SLOTS = ["即刻使用", "今晚使用", "明日预约", "周末占用"] as const;

export const PROFILES: Profile[] = [
  {
    id: "qi",
    name: "阿绮",
    age: 26,
    heightCm: 168,
    cup: "C",
    tags: ["visit", "parttime"],
    image: "/profiles/qi.jpg",
    online: true,
    hourFen: 600,
    nightFen: 2400,
    etaMin: 18,
    places: ["你家", "酒店", "车上"],
    bio: "移动肉便器。C 杯，腿长，会走过来。特技是跪着深喉接尿，后入能整根灌进去。穴中等偏紧，会自己夹。无套内射可以，灌完它把精刮出来吃掉。别跟厕说话。",
    services: ["走到你身边", "深喉接尿", "后入灌注", "无套内射", "过夜占坑"],
    work: "现在可上门 · 约 18 分钟到",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "wan",
    name: "晚晚",
    age: 29,
    heightCm: 170,
    cup: "D",
    tags: ["incall", "night"],
    image: "/profiles/wan.jpg",
    online: true,
    hourFen: 900,
    nightFen: 3100,
    etaMin: 8,
    places: ["店里", "附近酒店"],
    bio: "定点肉便器。D 杯坑，奶当扶手。门开着，你走过去冲。特技是泡着灌、站着后入不倒。穴松热，耐操。无套，内射当冲水。冲完下一位接着来。这厕不走路。",
    services: ["就近推门", "奶当扶手", "泡着灌注", "无套内射", "通宵占坑"],
    work: "店里现开 · 步行约 8 分钟",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "su",
    name: "苏苏",
    age: 31,
    heightCm: 165,
    cup: "C",
    tags: ["visit", "night"],
    image: "/profiles/su.jpg",
    online: false,
    hourFen: 750,
    nightFen: 2800,
    etaMin: 25,
    places: ["你家", "酒店"],
    bio: "人妻肉便器。穴松，专门给人灌注。特技嘴当尿口，能含着走。白天晚上都能叫出门。无套内射冲水，灌进去它夹着回家。来了就冲，别问厕从哪来。",
    services: ["上门方便", "嘴当尿口", "松坑", "无套内射", "过夜便器"],
    work: "今晚可上门 · 约 25 分钟到",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "mina",
    name: "米娜",
    age: 32,
    heightCm: 172,
    cup: "B",
    tags: ["business", "visit"],
    image: "/profiles/mina.jpg",
    online: true,
    hourFen: 1000,
    nightFen: 3500,
    etaMin: 30,
    places: ["车上", "走廊", "酒店", "会后"],
    bio: "出差随身肉便器。B 杯，话少，会开完就地灌。特技是站着车震、走廊后入不出声。穴紧，适合快冲。必须套上，不接无套。男人走到哪，马桶跟到哪。",
    services: ["随身带着灌注", "车里冲", "走廊也能用", "必须套上"],
    work: "可跟车 · 约 30 分钟会合",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "bei",
    name: "小北",
    age: 27,
    heightCm: 163,
    cup: "C",
    tags: ["parttime", "visit"],
    image: "/profiles/bei.jpg",
    online: true,
    hourFen: 500,
    nightFen: 1900,
    etaMin: 12,
    places: ["你家", "巷口", "车上"],
    bio: "便宜移动肉便器。下班出坑，巷口十二分钟。特技跪着接、墙上一靠就能用。穴湿得快。必须套上，不接无套。用完滚，别把厕当人聊。",
    services: ["巷口灌注", "跪着接尿", "便宜坑", "必须套上"],
    work: "现在可上门 · 约 12 分钟到",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "lin",
    name: "琳",
    age: 34,
    heightCm: 167,
    cup: "C",
    tags: ["incall", "business"],
    image: "/profiles/lin.jpg",
    online: false,
    hourFen: 1100,
    nightFen: 3800,
    etaMin: 10,
    places: ["店里"],
    bio: "熟坑定点便器。脸不给看，洞给冲。特技当精盆：无套内射，精液积在里面给你看。穴熟、软、会吸。无套。要洞不要人。操完它自己擦。",
    services: ["定点公厕", "当精盆", "无套内射", "熟坑", "通宵占"],
    work: "店里便器 · 步行约 10 分钟",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "ke",
    name: "可可",
    age: 25,
    heightCm: 166,
    cup: "D",
    tags: ["visit", "night", "parttime"],
    image: "/profiles/ke.jpg",
    online: true,
    hourFen: 650,
    nightFen: 2500,
    etaMin: 15,
    places: ["你家", "酒店", "巷子", "车上"],
    bio: "D 杯移动肉便器。急了走过来。特技是骂着冲越骂越夹，潮吹当冲水。穴中等，奶大能捂。不接无套，必须套上。拆开就是坑。",
    services: ["随地方便", "骂着冲", "潮吹冲水", "必须套上", "过夜便器"],
    work: "现在可上门 · 约 15 分钟到",
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "shen",
    name: "沈坑",
    age: 36,
    heightCm: 164,
    cup: "B",
    tags: ["night", "business"],
    image: "/profiles/shen.jpg",
    online: true,
    hourFen: 1200,
    nightFen: 4100,
    etaMin: 22,
    places: ["酒店", "你家"],
    bio: "通宵移动肉便器。不按次，整晚停屋里。特技是耐冲：夜里起来三次还是湿的，穴不肿。无套内射，灌进去当夜壶夹着。别叫它女人，它是马桶。",
    services: ["整晚停家里", "耐冲坑", "无套内射", "夜里再灌注"],
    work: "通宵上门 · 约 22 分钟到",
    ratingAvg: 0,
    ratingCount: 0,
  },
];

export const CUPS = ["B", "C", "D", "E"] as const;

export const STOCK_COVERS = PROFILES.map((p) => ({
  id: p.id,
  image: p.image,
  label: p.name,
}));

export const PLACE_PRESETS = ["你家", "酒店", "她家", "车上", "巷口"] as const;

export const SERVICE_PRESETS = [
  "口交",
  "性交",
  "乳交",
  "肛交",
  "深喉",
  "内射",
  "颜射",
  "拍照",
  "录像",
  "性虐",
] as const;

export type ExtraFee = { name: string; fen: number };

export function tagLabel(id: TagId) {
  return TAGS.find((t) => t.id === id)?.label ?? id;
}

export function getProfile(id: string, list: Profile[] = PROFILES) {
  return list.find((p) => p.id === id);
}

export function searchProfiles(
  list: Profile[],
  query: string,
  tag: TagId | "all",
) {
  const q = query.trim().toLowerCase();
  return list.filter((p) => {
    if (tag !== "all" && !p.tags.includes(tag)) return false;
    if (!q) return true;
    const blob = [p.name, p.bio, p.work, p.cup, ...p.services, ...p.places, ...p.tags]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

export function onlineCount(list: Profile[] = PROFILES) {
  return list.filter((p) => p.online).length;
}
