import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import {
  AREAS,
  PLACE_PRESETS,
  PROFILES,
  SERVICE_PRESETS,
  type ExtraFee,
  type Profile,
  type TagId,
} from "@/lib/profiles";
import {
  CONDOMS,
  DAILY_QUOTAS,
  DEMEANORS,
  FEELS,
  HOURS_TAGS,
  IDENTITIES,
  LISTING_DEFAULTS,
  MARRIAGES,
  MOANS,
  ORGASMS,
  PERSONAS,
  REVIEW_PREFS,
  SKILLS,
  TRAVELS,
} from "@/lib/listing";

const TAG_IDS = ["visit", "incall", "night", "parttime", "business"] as const;
const AREA_SET = AREAS.filter((a) => a !== "附近");

function isUserPhoto(value: string) {
  return (
    value.startsWith("data:image/jpeg;base64,") &&
    value.length > 80 &&
    value.length <= 280_000
  );
}

function isStoredPhoto(value: string) {
  return /^\/api\/media\/stalls\/[a-zA-Z0-9_-]+\.jpg$/.test(value) || /^https:\/\/.+\.jpg$/.test(value);
}

const StallInput = z.object({
  name: z.string().trim().min(1).max(12),
  age: z.number().int().min(18).max(55),
  heightCm: z.number().int().min(150).max(185),
  cup: z.enum(["B", "C", "D", "E"]),
  area: z.string().refine((v) => AREA_SET.includes(v as (typeof AREA_SET)[number])),
  tags: z.array(z.enum(TAG_IDS)).min(1).max(4),
  image: z.string().refine((v) => isUserPhoto(v) || isStoredPhoto(v), "上传自己的实拍"),
  online: z.boolean(),
  hourFen: z.number().int().min(2000).max(200000),
  nightFen: z.number().int().min(8000).max(800000),
  etaMin: z.number().int().min(5).max(90),
  places: z.array(z.string().min(1).max(8)).min(1).max(6),
  bio: z.string().trim().min(8).max(280),
  services: z.array(z.string().min(1).max(12)).min(1).max(8),
  confirmedAdult: z.literal(true),
  ownerToken: z.string().trim().max(24).optional(),
  weightKg: z.number().int().min(35).max(120).default(LISTING_DEFAULTS.weightKg),
  identity: z.enum(IDENTITIES).default(LISTING_DEFAULTS.identity),
  marriage: z.enum(MARRIAGES).default(LISTING_DEFAULTS.marriage),
  demeanor: z.enum(DEMEANORS).default(LISTING_DEFAULTS.demeanor),
  moan: z.enum(MOANS).default(LISTING_DEFAULTS.moan),
  skillLevel: z.enum(SKILLS).default(LISTING_DEFAULTS.skillLevel),
  orgasm: z.enum(ORGASMS).default(LISTING_DEFAULTS.orgasm),
  feel: z.enum(FEELS).default(LISTING_DEFAULTS.feel),
  persona: z.enum(PERSONAS).default(LISTING_DEFAULTS.persona),
  sellingPoints: z.array(z.string().min(1).max(16)).max(8).default([]),
  hoursTag: z.enum(HOURS_TAGS).default(LISTING_DEFAULTS.hoursTag),
  dailyQuota: z.enum(DAILY_QUOTAS).default(LISTING_DEFAULTS.dailyQuota),
  travel: z.enum(TRAVELS).default(LISTING_DEFAULTS.travel),
  condom: z.enum(CONDOMS).default(LISTING_DEFAULTS.condom),
  extras: z
    .array(
      z.object({
        name: z.string().min(1).max(12),
        fen: z.number().int().min(100).max(500000),
      }),
    )
    .max(10)
    .default([]),
  reviewPref: z.enum(REVIEW_PREFS).default(LISTING_DEFAULTS.reviewPref),
  depositFen: z.number().int().min(50000).max(300000).default(LISTING_DEFAULTS.depositFen),
});

export type StallInput = z.infer<typeof StallInput>;

type StallRow = {
  id: string;
  user_id: string;
  name: string;
  age: number;
  height_cm: number;
  cup: string;
  area: string;
  tags: TagId[] | string;
  image: string;
  online: boolean;
  hour_fen: number;
  night_fen: number;
  eta_min: number;
  places: string[] | string;
  bio: string;
  services: string[] | string;
  work: string;
  rating_avg?: number;
  rating_count?: number;
  featured?: boolean;
  hidden?: boolean;
  owner_id?: string | null;
  stall_token?: string | null;
  listed_fen?: number | null;
  relation?: string | null;
  weight_kg?: number | null;
  identity?: string | null;
  marriage?: string | null;
  demeanor?: string | null;
  moan?: string | null;
  skill_level?: string | null;
  orgasm?: string | null;
  feel?: string | null;
  persona?: string | null;
  selling_points?: string[] | string | null;
  hours_tag?: string | null;
  daily_quota?: string | null;
  travel?: string | null;
  condom?: string | null;
  extras?: ExtraFee[] | string[] | string | null;
  review_pref?: string | null;
  deposit_fen?: number | null;
};

export type MineStall = Profile & { hasOwner: boolean; stallToken: string | null };

function parseJsonArray<T>(value: T[] | string): T[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseExtras(value: ExtraFee[] | string[] | string | null | undefined): ExtraFee[] {
  const rows = parseJsonArray<ExtraFee | string>(value ?? []);
  const out: ExtraFee[] = [];
  for (const row of rows) {
    if (typeof row === "string") continue;
    if (!row || typeof row.name !== "string") continue;
    const fen = Number(row.fen);
    if (!Number.isFinite(fen) || fen < 100) continue;
    out.push({ name: row.name, fen });
  }
  return out;
}

function toProfile(row: StallRow): Profile {
  return {
    id: row.id,
    name: row.name,
    age: Number(row.age),
    heightCm: Number(row.height_cm),
    cup: row.cup,
    area: row.area,
    tags: parseJsonArray<TagId>(row.tags),
    image: row.image,
    online: Boolean(row.online),
    hourFen: Number(row.hour_fen),
    nightFen: Number(row.night_fen),
    etaMin: Number(row.eta_min),
    places: parseJsonArray<string>(row.places),
    bio: row.bio,
    services: parseJsonArray<string>(row.services),
    work: row.work,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
    owned: Boolean(row.owner_id && !String(row.owner_id).startsWith("seed:")),
    unowned: !row.owner_id,
    listedFen: row.listed_fen == null ? null : Number(row.listed_fen),
    relation: row.relation ?? null,
    weightKg: Number(row.weight_kg ?? LISTING_DEFAULTS.weightKg),
    identity: row.identity || LISTING_DEFAULTS.identity,
    marriage: row.marriage || LISTING_DEFAULTS.marriage,
    demeanor: row.demeanor || LISTING_DEFAULTS.demeanor,
    moan: row.moan || LISTING_DEFAULTS.moan,
    skillLevel: row.skill_level || LISTING_DEFAULTS.skillLevel,
    orgasm: row.orgasm || LISTING_DEFAULTS.orgasm,
    feel: row.feel || LISTING_DEFAULTS.feel,
    persona: row.persona || LISTING_DEFAULTS.persona,
    sellingPoints: parseJsonArray<string>(row.selling_points ?? []),
    hoursTag: row.hours_tag || LISTING_DEFAULTS.hoursTag,
    dailyQuota: row.daily_quota || LISTING_DEFAULTS.dailyQuota,
    travel: row.travel || LISTING_DEFAULTS.travel,
    condom: row.condom || LISTING_DEFAULTS.condom,
    extras: parseExtras(row.extras),
    reviewPref: row.review_pref || LISTING_DEFAULTS.reviewPref,
    depositFen: Number(row.deposit_fen ?? LISTING_DEFAULTS.depositFen),
  };
}

function autoWork(data: { online: boolean; tags: TagId[]; etaMin: number }) {
  if (!data.online) return "本厕暂停接单";
  if (data.tags.includes("visit")) return `可上门 · 约 ${data.etaMin} 分钟抵达`;
  return `定点肉厕 · 步行约 ${data.etaMin} 分钟`;
}

async function ensureSeeded(sql: Sql) {
  const counted = await sql<{ n: number }>`select count(*)::int as n from stalls`;
  if (Number(counted[0]?.n ?? 0) === 0) {
    for (const p of PROFILES) {
      await sql`
        insert into stalls (
          id, user_id, name, age, height_cm, cup, area, tags, image, online,
          hour_fen, night_fen, eta_min, places, bio, services, work, owner_id
        ) values (
          ${p.id}, ${`seed:${p.id}`}, ${p.name}, ${p.age}, ${p.heightCm}, ${p.cup}, ${p.area},
          ${JSON.stringify(p.tags)}::jsonb, ${p.image}, ${p.online},
          ${p.hourFen}, ${p.nightFen}, ${p.etaMin}, ${JSON.stringify(p.places)}::jsonb,
          ${p.bio}, ${JSON.stringify(p.services)}::jsonb, ${p.work}, ${"seed:owner"}
        )
      `;
    }
    return;
  }
  for (const p of PROFILES) {
    await sql`
      update stalls set
        name = ${p.name},
        bio = ${p.bio},
        services = ${JSON.stringify(p.services)}::jsonb,
        work = ${p.work}
      where user_id = ${`seed:${p.id}`}
    `;
  }
}

export async function findStall(sql: Sql, id: string) {
  await ensureSeeded(sql);
  const rows = await sql<StallRow>`
    select s.*,
      coalesce(r.avg, 0) as rating_avg,
      coalesce(r.n, 0) as rating_count
    from stalls s
    left join (
      select profile_id, avg(score)::float as avg, count(*)::int as n
      from reviews
      group by profile_id
    ) r on r.profile_id = s.id
    where s.id = ${id} and coalesce(s.hidden, false) = false
    limit 1
  `;
  return rows[0] ? toProfile(rows[0]) : undefined;
}

export const listPublicStalls = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureSeeded(sql);
  const rows = await sql<StallRow>`
    select s.*,
      coalesce(r.avg, 0) as rating_avg,
      coalesce(r.n, 0) as rating_count
    from stalls s
    left join (
      select profile_id, avg(score)::float as avg, count(*)::int as n
      from reviews
      group by profile_id
    ) r on r.profile_id = s.id
    where coalesce(s.hidden, false) = false
    order by coalesce(s.featured, false) desc, s.online desc, s.created_at desc
  `;
  return rows.map(toProfile);
});

export const getPublicStall = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return (await findStall(sql, data.id)) ?? null;
  });

export const getMyStall = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSeeded(sql);
    const rows = await sql<StallRow>`
      select * from stalls where user_id = ${context.userId} limit 1
    `;
    if (!rows[0]) return null;
    const { ensureStallToken } = await import("@/lib/owners");
    const stallToken = await ensureStallToken(sql, rows[0].id);
    return {
      ...toProfile(rows[0]),
      hasOwner: Boolean(rows[0].owner_id && !String(rows[0].owner_id).startsWith("seed:")),
      stallToken,
    };
  });

export const saveMyStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => StallInput.parse(data))
  .handler(async ({ context, data }) => {
    if (context.userId.startsWith("seed:")) throw new Error("种子便器不能改");
    const { assertRole } = await import("@/lib/roles");
    await assertRole(context.userId, "stall");
    const sql = await getSql();
    await ensureSeeded(sql);
    const work = autoWork(data);
    const existing = await sql<{ id: string }>`
      select id from stalls where user_id = ${context.userId} limit 1
    `;
    const id = existing[0]?.id ?? `t${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const currentOwner = existing[0]
      ? (
          await sql<{ owner_id: string | null }>`
            select owner_id from stalls where id = ${existing[0].id} limit 1
          `
        )[0]?.owner_id
      : null;
    let ownerId = currentOwner ?? null;
    if (!ownerId && data.ownerToken?.trim()) {
      const { lookupOwnerId } = await import("@/lib/owners");
      ownerId = await lookupOwnerId(data.ownerToken);
    }
    let image = data.image;
    if (isUserPhoto(data.image)) {
      const { putStallJpeg } = await import("@/lib/r2.server");
      image = await putStallJpeg(id, data.image);
    }
    if (existing[0]) {
      await sql`
        update stalls set
          name = ${data.name},
          age = ${data.age},
          height_cm = ${data.heightCm},
          cup = ${data.cup},
          area = ${data.area},
          tags = ${JSON.stringify(data.tags)}::jsonb,
          image = ${image},
          online = ${data.online},
          hour_fen = ${data.hourFen},
          night_fen = ${data.nightFen},
          eta_min = ${data.etaMin},
          places = ${JSON.stringify(data.places)}::jsonb,
          bio = ${data.bio},
          services = ${JSON.stringify(data.services)}::jsonb,
          work = ${work},
          owner_id = ${ownerId},
          weight_kg = ${data.weightKg},
          identity = ${data.identity},
          marriage = ${data.marriage},
          demeanor = ${data.demeanor},
          moan = ${data.moan},
          skill_level = ${data.skillLevel},
          orgasm = ${data.orgasm},
          feel = ${data.feel},
          persona = ${data.persona},
          selling_points = ${JSON.stringify(data.sellingPoints)}::jsonb,
          hours_tag = ${data.hoursTag},
          daily_quota = ${data.dailyQuota},
          travel = ${data.travel},
          condom = ${data.condom},
          extras = ${JSON.stringify(data.extras)}::jsonb,
          review_pref = ${data.reviewPref},
          deposit_fen = ${data.depositFen},
          updated_at = now()
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into stalls (
          id, user_id, name, age, height_cm, cup, area, tags, image, online,
          hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
          weight_kg, identity, marriage, demeanor, moan, skill_level, orgasm, feel,
          persona, selling_points, hours_tag, daily_quota, travel, condom, extras,
          review_pref, deposit_fen
        ) values (
          ${id}, ${context.userId}, ${data.name}, ${data.age}, ${data.heightCm}, ${data.cup},
          ${data.area}, ${JSON.stringify(data.tags)}::jsonb, ${image}, ${data.online},
          ${data.hourFen}, ${data.nightFen}, ${data.etaMin}, ${JSON.stringify(data.places)}::jsonb,
          ${data.bio}, ${JSON.stringify(data.services)}::jsonb, ${work}, ${ownerId},
          ${data.weightKg}, ${data.identity}, ${data.marriage}, ${data.demeanor}, ${data.moan},
          ${data.skillLevel}, ${data.orgasm}, ${data.feel}, ${data.persona},
          ${JSON.stringify(data.sellingPoints)}::jsonb, ${data.hoursTag}, ${data.dailyQuota},
          ${data.travel}, ${data.condom}, ${JSON.stringify(data.extras)}::jsonb,
          ${data.reviewPref}, ${data.depositFen}
        )
      `;
    }
    const rows = await sql<StallRow>`
      select * from stalls where user_id = ${context.userId} limit 1
    `;
    if (!rows[0]) throw new Error("没写成");
    const { ensureStallToken } = await import("@/lib/owners");
    const stallToken = await ensureStallToken(sql, rows[0].id);
    return {
      ...toProfile(rows[0]),
      hasOwner: Boolean(rows[0].owner_id && !String(rows[0].owner_id).startsWith("seed:")),
      stallToken,
    };
  });

export const setMyStallOnline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ online: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeeded(sql);
    const rows = await sql<StallRow>`
      select * from stalls where user_id = ${context.userId} limit 1
    `;
    if (!rows[0]) throw new Error("还没登记这具便器");
    const current = toProfile(rows[0]);
    const work = autoWork({
      tags: current.tags as StallInput["tags"],
      online: data.online,
      etaMin: current.etaMin,
    });
    await sql`
      update stalls
      set online = ${data.online}, work = ${work}, updated_at = now()
      where user_id = ${context.userId}
    `;
    const { recordEvent } = await import("@/lib/behavior");
    await recordEvent({
      userId: context.userId,
      kind: data.online ? "stall_online" : "stall_offline",
      targetId: current.id,
    });
    return { ...current, online: data.online, work };
  });

export const listOwnedStalls = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<StallRow>`
      select * from stalls
      where owner_id = ${context.userId}
      order by updated_at desc
    `;
    return rows.map(toProfile);
  });

export const getOwnedStall = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<StallRow>`
      select * from stalls where id = ${data.id} and owner_id = ${context.userId} limit 1
    `;
    return rows[0] ? toProfile(rows[0]) : null;
  });

export const saveOwnedStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    StallInput.extend({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    if (context.userId.startsWith("seed:")) throw new Error("种子号不能改");
    const sql = await getSql();
    const mine = await sql<{ id: string }>`
      select id from stalls where id = ${data.id} and owner_id = ${context.userId} limit 1
    `;
    if (!mine[0]) throw new Error("这具不是你的货");
    const work = autoWork(data);
    let image = data.image;
    if (isUserPhoto(data.image)) {
      const { putStallJpeg } = await import("@/lib/r2.server");
      image = await putStallJpeg(data.id, data.image);
    }
    await sql`
      update stalls set
        name = ${data.name},
        age = ${data.age},
        height_cm = ${data.heightCm},
        cup = ${data.cup},
        area = ${data.area},
        tags = ${JSON.stringify(data.tags)}::jsonb,
        image = ${image},
        online = ${data.online},
        hour_fen = ${data.hourFen},
        night_fen = ${data.nightFen},
        eta_min = ${data.etaMin},
        places = ${JSON.stringify(data.places)}::jsonb,
        bio = ${data.bio},
        services = ${JSON.stringify(data.services)}::jsonb,
        work = ${work},
        weight_kg = ${data.weightKg},
        identity = ${data.identity},
        marriage = ${data.marriage},
        demeanor = ${data.demeanor},
        moan = ${data.moan},
        skill_level = ${data.skillLevel},
        orgasm = ${data.orgasm},
        feel = ${data.feel},
        persona = ${data.persona},
        selling_points = ${JSON.stringify(data.sellingPoints)}::jsonb,
        hours_tag = ${data.hoursTag},
        daily_quota = ${data.dailyQuota},
        travel = ${data.travel},
        condom = ${data.condom},
        extras = ${JSON.stringify(data.extras)}::jsonb,
        review_pref = ${data.reviewPref},
        deposit_fen = ${data.depositFen},
        updated_at = now()
      where id = ${data.id} and owner_id = ${context.userId}
    `;
    const rows = await sql<StallRow>`
      select * from stalls where id = ${data.id} limit 1
    `;
    if (!rows[0]) throw new Error("没写成");
    return toProfile(rows[0]);
  });

const OwnedCreate = StallInput.extend({
  relation: z.enum(["妻子", "母亲", "女儿", "女友", "同事", "其他"]),
  stallEmail: z.string().trim().email("请填写肉厕登录邮箱").transform((v) => v.toLowerCase()),
});

export const createOwnedStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => OwnedCreate.parse(data))
  .handler(async ({ context, data }) => {
    if (context.userId.startsWith("seed:")) throw new Error("种子号不能挂");
    const { assertRole } = await import("@/lib/roles");
    await assertRole(context.userId, "male");
    if (data.age < 18) throw new Error("必须满 18 岁");
    if (data.relation === "女儿" && data.age < 18) throw new Error("女儿必须满 18 岁");
    const sql = await getSql();
    const id = `t${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    let image = data.image;
    if (isUserPhoto(data.image)) {
      const { putStallJpeg } = await import("@/lib/r2.server");
      image = await putStallJpeg(id, data.image);
    }
    const work = autoWork(data);
    const { mintToken, ensureStallToken } = await import("@/lib/owners");
    const { createStallLogin } = await import("@/lib/stall-account");
    const login = await createStallLogin(data.stallEmail, data.name, context.userId);
    const token = mintToken("TC");
    await sql`
      insert into stalls (
        id, user_id, name, age, height_cm, cup, area, tags, image, online,
        hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
        stall_token, relation,
        weight_kg, identity, marriage, demeanor, moan, skill_level, orgasm, feel,
        persona, selling_points, hours_tag, daily_quota, travel, condom, extras,
        review_pref, deposit_fen
      ) values (
        ${id}, ${login.userId}, ${data.name}, ${data.age}, ${data.heightCm}, ${data.cup},
        ${data.area}, ${JSON.stringify(data.tags)}::jsonb, ${image}, ${data.online},
        ${data.hourFen}, ${data.nightFen}, ${data.etaMin}, ${JSON.stringify(data.places)}::jsonb,
        ${data.bio}, ${JSON.stringify(data.services)}::jsonb, ${work}, ${context.userId},
        ${token}, ${data.relation},
        ${data.weightKg}, ${data.identity}, ${data.marriage}, ${data.demeanor}, ${data.moan},
        ${data.skillLevel}, ${data.orgasm}, ${data.feel}, ${data.persona},
        ${JSON.stringify(data.sellingPoints)}::jsonb, ${data.hoursTag}, ${data.dailyQuota},
        ${data.travel}, ${data.condom}, ${JSON.stringify(data.extras)}::jsonb,
        ${data.reviewPref}, ${data.depositFen}
      )
    `;
    await ensureStallToken(sql, id);
    const rows = await sql<StallRow>`select * from stalls where id = ${id} limit 1`;
    if (!rows[0]) throw new Error("没写成");
    return {
      ...toProfile(rows[0]),
      loginEmail: login.email,
      loginPassword: login.password,
    };
  });

export const PLACE_OPTIONS = PLACE_PRESETS;
export const SERVICE_OPTIONS = SERVICE_PRESETS;
