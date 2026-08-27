import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { distanceM, NEARBY_RADIUS_M } from "@/lib/geo";
import { holdingCut } from "@/lib/yield";
import { isBusy } from "@/lib/occupancy";
import {
  PLACE_PRESETS,
  PROFILES,
  RELATIONS,
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
  JOBS,
  LISTING_DEFAULTS,
  MARRIAGES,
  PERSONALITIES,
  MOANS,
  ORGASMS,
  PERSONAS,
  REVIEW_PREFS,
  SKILLS,
  TRAVELS,
} from "@/lib/listing";

const TAG_IDS = ["visit", "incall", "night", "parttime", "business"] as const;

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
  name: z.string().trim().min(1).max(16).transform((v) => v.replace(/\s+/g, " ")),
  age: z.number().int().min(18).max(55),
  heightCm: z.number().int().min(150).max(185),
  cup: z.enum(["B", "C", "D", "E"]),
  tags: z.array(z.enum(TAG_IDS)).min(1).max(5),
  image: z.string().refine((v) => isUserPhoto(v) || isStoredPhoto(v), "上传自己的实拍"),
  online: z.boolean(),
  hourFen: z.number().int().min(0).max(1_000_000_000),
  nightFen: z.number().int().min(0).max(1_000_000_000),
  etaMin: z.number().int().min(5).max(90),
  places: z.array(z.string().min(1).max(8)).min(1).max(10),
  bio: z.string().trim().min(8).max(280),
  services: z.array(z.string().min(1).max(12)).min(1).max(20),
  confirmedAdult: z.literal(true),
  ownerToken: z.string().trim().max(24).optional(),
  weightKg: z.number().int().min(35).max(120).default(LISTING_DEFAULTS.weightKg),
  identity: z.enum(IDENTITIES).default(LISTING_DEFAULTS.identity),
  job: z.enum(JOBS).default(LISTING_DEFAULTS.job),
  personality: z.enum(PERSONALITIES).default(LISTING_DEFAULTS.personality),
  marriage: z.enum(MARRIAGES).default(LISTING_DEFAULTS.marriage),
  demeanor: z.enum(DEMEANORS).default(LISTING_DEFAULTS.demeanor),
  moan: z.enum(MOANS).default(LISTING_DEFAULTS.moan),
  skillLevel: z.enum(SKILLS).default(LISTING_DEFAULTS.skillLevel),
  orgasm: z.enum(ORGASMS).default(LISTING_DEFAULTS.orgasm),
  feel: z.enum(FEELS).default(LISTING_DEFAULTS.feel),
  persona: z.enum(PERSONAS).default(LISTING_DEFAULTS.persona),
  sellingPoints: z.array(z.string().min(1).max(16)).max(5).default([]),
  hoursTag: z.enum(HOURS_TAGS).default(LISTING_DEFAULTS.hoursTag),
  dailyQuota: z.enum(DAILY_QUOTAS).default(LISTING_DEFAULTS.dailyQuota),
  travel: z.enum(TRAVELS).default(LISTING_DEFAULTS.travel),
  condom: z.enum(CONDOMS).default(LISTING_DEFAULTS.condom),
  extras: z
    .array(
      z.object({
        name: z.string().min(1).max(12),
        fen: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .max(20)
    .default([]),
  reviewPref: z.enum(REVIEW_PREFS).default(LISTING_DEFAULTS.reviewPref),
  depositFen: z.number().int().min(0).max(1_000_000_000).default(LISTING_DEFAULTS.depositFen),
});

export type StallInput = z.infer<typeof StallInput>;

type StallRow = {
  id: string;
  user_id: string;
  name: string;
  age: number;
  height_cm: number;
  cup: string;
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
  location_id?: string | null;
  weight_kg?: number | null;
  identity?: string | null;
  job?: string | null;
  personality?: string | null;
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
  person_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  owned_at?: string | null;
  busy_until?: string | null;
  busy_inquiry_id?: string | null;
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
    if (!Number.isFinite(fen) || fen < 0) continue;
    out.push({ name: row.name, fen });
  }
  return out;
}

function toProfile(row: StallRow): Profile {
  const cut = holdingCut(row.relation, row.owned_at);
  return {
    id: row.id,
    name: row.name,
    age: Number(row.age),
    heightCm: Number(row.height_cm),
    cup: row.cup,
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
    locationId: row.location_id ?? null,
    weightKg: Number(row.weight_kg ?? LISTING_DEFAULTS.weightKg),
    identity: row.identity || LISTING_DEFAULTS.identity,
    job: row.job || LISTING_DEFAULTS.job,
    personality: row.personality || LISTING_DEFAULTS.personality,
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
    personId: row.person_id ?? null,
    holdWeeks: row.owner_id ? cut.weeks : undefined,
    ownerSharePct: row.owner_id ? cut.ownerSharePct : undefined,
    platformSharePct: row.owner_id ? cut.platformSharePct : undefined,
    busyUntil: row.busy_until ?? null,
    busy: isBusy(row.busy_until ?? null),
  };
}

function autoWork(data: { online: boolean; tags: TagId[]; etaMin: number }) {
  if (!data.online) return "本厕暂停接单";
  if (data.tags.includes("visit")) return `可上门 · 约 ${data.etaMin} 分钟抵达`;
  return `定点肉厕 · 步行约 ${data.etaMin} 分钟`;
}

async function ensureSeeded(sql: Sql) {
  const { ensureGtaPeople } = await import("@/lib/seed-gta");
  await ensureGtaPeople(sql);
}

export async function listStallsNear(
  sql: Sql,
  lat: number,
  lng: number,
  radiusM = NEARBY_RADIUS_M,
  viewerId?: string,
) {
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
      and s.lat is not null and s.lng is not null
      and s.online = true
      and (s.busy_until is null or s.busy_until <= now())
  `;
  return rows
    .map((row) => {
      const d = distanceM(lat, lng, Number(row.lat), Number(row.lng));
      return {
        ...toProfile(row),
        distanceM: d,
        mine: Boolean(viewerId && row.owner_id === viewerId),
      };
    })
    .filter((p) => (p.distanceM ?? Infinity) <= radiusM)
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
    .slice(0, 80);
}

export async function findStall(sql: Sql, id: string, viewerId?: string) {
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
  return rows[0]
    ? { ...toProfile(rows[0]), mine: Boolean(viewerId && rows[0].owner_id === viewerId) }
    : undefined;
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
    limit 80
  `;
  return rows.map(toProfile);
});

export const getPublicStall = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    return (await findStall(sql, data.id, user?.id)) ?? null;
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
          tags = ${JSON.stringify(data.tags)}::jsonb,
          image = ${image},
          hour_fen = ${data.hourFen},
          night_fen = ${data.nightFen},
          eta_min = ${data.etaMin},
          places = ${JSON.stringify(data.places)}::jsonb,
          bio = ${data.bio},
          services = ${JSON.stringify(data.services)}::jsonb,
          work = ${work},
          owner_id = ${ownerId},
          owned_at = case
            when ${ownerId}::text is not null and owner_id is distinct from ${ownerId} then now()
            when ${ownerId}::text is null then null
            else owned_at
          end,
          weight_kg = ${data.weightKg},
          identity = ${data.identity},
          job = ${data.job},
          personality = ${data.personality},
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
          id, user_id, name, age, height_cm, cup, tags, image, online,
          hour_fen, night_fen, eta_min, places, bio, services, work, owner_id, owned_at,
          weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level, orgasm, feel,
          persona, selling_points, hours_tag, daily_quota, travel, condom, extras,
          review_pref, deposit_fen
        ) values (
          ${id}, ${context.userId}, ${data.name}, ${data.age}, ${data.heightCm}, ${data.cup},
          ${JSON.stringify(data.tags)}::jsonb, ${image}, true,
          ${data.hourFen}, ${data.nightFen}, ${data.etaMin}, ${JSON.stringify(data.places)}::jsonb,
          ${data.bio}, ${JSON.stringify(data.services)}::jsonb, ${work}, ${ownerId},
          ${ownerId ? new Date() : null},
          ${data.weightKg}, ${data.identity}, ${data.job}, ${data.personality}, ${data.marriage}, ${data.demeanor}, ${data.moan},
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
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSeeded(sql);
    const rows = await sql<StallRow>`
      select * from stalls where user_id = ${context.userId} limit 1
    `;
    if (!rows[0]) throw new Error("还没登记这具便器");
    throw new Error("休息由所属人控制。挂牌出租后必须接单");
  });

export const setOwnedStallOnline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1), online: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<StallRow>`
      select * from stalls where id = ${data.id} and owner_id = ${context.userId} limit 1
    `;
    if (!rows[0]) throw new Error("这具不是你的货");
    if (isBusy(rows[0].busy_until)) throw new Error("使用中不能改休息，等这 30 分钟结束");
    const current = toProfile(rows[0]);
    const work = autoWork({
      tags: current.tags as StallInput["tags"],
      online: data.online,
      etaMin: current.etaMin,
    });
    await sql`
      update stalls
      set online = ${data.online}, work = ${work}, updated_at = now()
      where id = ${data.id} and owner_id = ${context.userId}
    `;
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
    const list = rows.map(toProfile);
    const due = list.filter((p) => !p.listedFen && (p.holdWeeks ?? 0) >= 1);
    if (due.length) {
      const { suggestListFen, stallUsage } = await import("@/lib/econ");
      const usage = await stallUsage(sql, due.map((p) => p.id));
      for (const p of due) {
        const fen = suggestListFen(p, usage.get(p.id));
        await sql`
          update stalls set listed_fen = ${fen}, updated_at = now()
          where id = ${p.id} and owner_id = ${context.userId} and listed_fen is null
        `;
        p.listedFen = fen;
      }
    }
    return list;
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
        job = ${data.job},
        personality = ${data.personality},
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
  relation: z.enum(RELATIONS),
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
    if ((data.relation === "女儿" || data.relation === "兄妹") && data.age < 18) {
      throw new Error("女儿、兄妹必须满 18 岁");
    }
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
        id, user_id, name, age, height_cm, cup, tags, image, online,
        hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
        stall_token, relation, owned_at,
        weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level, orgasm, feel,
        persona, selling_points, hours_tag, daily_quota, travel, condom, extras,
        review_pref, deposit_fen
      ) values (
        ${id}, ${login.userId}, ${data.name}, ${data.age}, ${data.heightCm}, ${data.cup},
        ${JSON.stringify(data.tags)}::jsonb, ${image}, true,
        ${data.hourFen}, ${data.nightFen}, ${data.etaMin}, ${JSON.stringify(data.places)}::jsonb,
        ${data.bio}, ${JSON.stringify(data.services)}::jsonb, ${work}, ${context.userId},
        ${token}, ${data.relation}, now(),
        ${data.weightKg}, ${data.identity}, ${data.job}, ${data.personality}, ${data.marriage}, ${data.demeanor}, ${data.moan},
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
