export type TagId = "visit" | "incall" | "night" | "parttime" | "business";

export type Profile = {
  id: string;
  name: string;
  age: number;
  heightCm: number;
  cup: string;
  area: string;
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
};

export const TAGS: { id: TagId | "all"; label: string }[] = [
  { id: "all", label: "全部肉厕" },
  { id: "visit", label: "会走过来" },
  { id: "incall", label: "定点公厕" },
  { id: "night", label: "通宵肉厕" },
  { id: "parttime", label: "下班坑" },
  { id: "business", label: "随身厕" },
];

export const AREAS = ["附近", "徐汇", "静安", "黄浦", "长宁", "浦东"] as const;

export const SLOTS = ["现在就冲", "今晚方便", "明天随时", "周末占坑"] as const;

export const PROFILES: Profile[] = [
  {
    id: "qi",
    name: "阿绮",
    age: 26,
    heightCm: 168,
    cup: "C",
    area: "徐汇",
    tags: ["visit", "parttime"],
    image: "/profiles/qi.jpg",
    online: true,
    hourFen: 6000,
    nightFen: 24000,
    etaMin: 18,
    places: ["你家", "酒店", "车上"],
    bio: "移动肉厕。男人急了叫它走过来，你家、酒店、车后座都能当坑。别跟厕说话，拉开就泄。冲完走人，它自己擦。",
    services: ["走到你身边", "跪着接尿", "当马桶冲", "后入泄", "过夜占坑"],
    work: "现在可上门 · 约 18 分钟到",
  },
  {
    id: "wan",
    name: "晚晚",
    age: 29,
    heightCm: 170,
    cup: "D",
    area: "静安",
    tags: ["incall", "night"],
    image: "/profiles/wan.jpg",
    online: true,
    hourFen: 9000,
    nightFen: 31000,
    etaMin: 8,
    places: ["店里", "附近酒店"],
    bio: "定点肉厕。D 杯坑，门开着。急了就近推门，当公共马桶用。冲完下一位接着来。这厕不走路，你走过去。",
    services: ["就近推门", "当精厕", "奶当扶手", "泡着泄", "通宵占坑"],
    work: "店里现开 · 步行约 8 分钟",
  },
  {
    id: "su",
    name: "苏苏",
    age: 31,
    heightCm: 165,
    cup: "C",
    area: "黄浦",
    tags: ["visit", "night"],
    image: "/profiles/su.jpg",
    online: false,
    hourFen: 7500,
    nightFen: 28000,
    etaMin: 25,
    places: ["你家", "酒店"],
    bio: "人妻肉厕。白天晚上都能叫出门，走到你方便的地方。穴松，专门给人泄。来了就冲，别问厕从哪来。",
    services: ["上门方便", "嘴当尿口", "松坑", "内射冲水", "过夜厕"],
    work: "今晚可上门 · 约 25 分钟到",
  },
  {
    id: "mina",
    name: "米娜",
    age: 32,
    heightCm: 172,
    cup: "B",
    area: "浦东",
    tags: ["business", "visit"],
    image: "/profiles/mina.jpg",
    online: true,
    hourFen: 10000,
    nightFen: 35000,
    etaMin: 30,
    places: ["车上", "走廊", "酒店", "会后"],
    bio: "出差随身肉厕。挂在旁边，会开完就地泄。车里、走廊、酒店都是坑。话少，因为它是厕。男人走到哪，厕跟到哪。",
    services: ["随身带着泄", "车里冲", "会后方便", "走廊也能用"],
    work: "可跟车 · 约 30 分钟会合",
  },
  {
    id: "bei",
    name: "小北",
    age: 27,
    heightCm: 163,
    cup: "C",
    area: "长宁",
    tags: ["parttime", "visit"],
    image: "/profiles/bei.jpg",
    online: true,
    hourFen: 5000,
    nightFen: 19000,
    etaMin: 12,
    places: ["你家", "巷口", "车上"],
    bio: "便宜移动肉厕。下班后出坑，谁急谁叫。巷口、车上、你家，湿了就能冲。必须套上。用完滚，别把厕当人聊。",
    services: ["就近方便", "巷口泄", "跪着接", "便宜坑"],
    work: "现在可上门 · 约 12 分钟到",
  },
  {
    id: "lin",
    name: "琳",
    age: 34,
    heightCm: 167,
    cup: "C",
    area: "徐汇",
    tags: ["incall", "business"],
    image: "/profiles/lin.jpg",
    online: false,
    hourFen: 11000,
    nightFen: 38000,
    etaMin: 10,
    places: ["店里"],
    bio: "熟坑定点厕。脸不给看，洞给冲。男人路过就推门。要厕不要人。操完它自己擦。别夸厕。",
    services: ["定点公厕", "当精盆", "熟坑", "泡着冲", "通宵占"],
    work: "店里厕 · 步行约 10 分钟",
  },
  {
    id: "ke",
    name: "可可",
    age: 25,
    heightCm: 166,
    cup: "D",
    area: "静安",
    tags: ["visit", "night", "parttime"],
    image: "/profiles/ke.jpg",
    online: true,
    hourFen: 6500,
    nightFen: 25000,
    etaMin: 15,
    places: ["你家", "酒店", "巷子", "车上"],
    bio: "D 杯移动肉厕。急了它走过来。酒店、你家、巷子、后座都能当公共马桶。可以骂着冲。不接无套。拆开就是坑。",
    services: ["随地方便", "骂着冲", "巷子也能泄", "当马桶", "过夜厕"],
    work: "现在可上门 · 约 15 分钟到",
  },
  {
    id: "shen",
    name: "沈小姐",
    age: 36,
    heightCm: 164,
    cup: "B",
    area: "黄浦",
    tags: ["night", "business"],
    image: "/profiles/shen.jpg",
    online: true,
    hourFen: 12000,
    nightFen: 41000,
    etaMin: 22,
    places: ["酒店", "你家"],
    bio: "通宵移动肉厕。不按次，整晚停在你屋里。夜里随时起来方便，不用再出门找下一座。别叫它小姐，它是厕。",
    services: ["整晚停家里", "随时方便", "耐冲坑", "夜里再泄"],
    work: "通宵上门 · 约 22 分钟到",
  },
];

export const CUPS = ["B", "C", "D", "E"] as const;

export const STOCK_COVERS = PROFILES.map((p) => ({
  id: p.id,
  image: p.image,
  label: p.name,
}));

export const PLACE_PRESETS = ["你家", "酒店", "车上", "巷口", "店里", "走廊"] as const;

export const SERVICE_PRESETS = [
  "走到你身边",
  "跪着接尿",
  "当马桶冲",
  "随地方便",
  "车里冲",
  "巷口泄",
  "通宵占坑",
  "骂着冲",
  "过夜厕",
] as const;

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
  area: string,
) {
  const q = query.trim().toLowerCase();
  return list.filter((p) => {
    if (tag !== "all" && !p.tags.includes(tag)) return false;
    if (area !== "附近" && p.area !== area) return false;
    if (!q) return true;
    const blob = [p.name, p.area, p.bio, p.work, p.cup, ...p.services, ...p.places, ...p.tags]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

export function onlineCount(list: Profile[] = PROFILES) {
  return list.filter((p) => p.online).length;
}
