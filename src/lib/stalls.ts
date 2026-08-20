import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import {
  AREAS,
  PLACE_PRESETS,
  PROFILES,
  SERVICE_PRESETS,
  type Profile,
  type TagId,
} from "@/lib/profiles";

const TAG_IDS = ["visit", "incall", "night", "parttime", "business"] as const;
const AREA_SET = AREAS.filter((a) => a !== "附近");

function isUserPhoto(value: string) {
  return (
    value.startsWith("data:image/jpeg;base64,") &&
    value.length > 80 &&
    value.length <= 280_000
  );
}

const StallInput = z.object({
  name: z.string().trim().min(1).max(12),
  age: z.number().int().min(18).max(55),
  heightCm: z.number().int().min(150).max(185),
  cup: z.enum(["B", "C", "D", "E"]),
  area: z.string().refine((v) => AREA_SET.includes(v as (typeof AREA_SET)[number])),
  tags: z.array(z.enum(TAG_IDS)).min(1).max(4),
  image: z.string().refine(isUserPhoto, "上传自己的实拍"),
  online: z.boolean(),
  hourFen: z.number().int().min(2000).max(200000),
  nightFen: z.number().int().min(8000).max(800000),
  etaMin: z.number().int().min(5).max(90),
  places: z.array(z.string().min(1).max(8)).min(1).max(6),
  bio: z.string().trim().min(8).max(280),
  services: z.array(z.string().min(1).max(12)).min(1).max(8),
  confirmedAdult: z.literal(true),
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
};

function parseJsonArray<T>(value: T[] | string): T[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  };
}

function autoWork(data: StallInput) {
  if (!data.online) return "这具便器暂时关着";
  if (data.tags.includes("visit")) return `现在可上门 · 约 ${data.etaMin} 分钟到`;
  return `定点坑 · 步行约 ${data.etaMin} 分钟`;
}

async function ensureSeeded(sql: Sql) {
  const counted = await sql<{ n: number }>`select count(*)::int as n from stalls`;
  if (Number(counted[0]?.n ?? 0) === 0) {
    for (const p of PROFILES) {
      await sql`
        insert into stalls (
          id, user_id, name, age, height_cm, cup, area, tags, image, online,
          hour_fen, night_fen, eta_min, places, bio, services, work
        ) values (
          ${p.id}, ${`seed:${p.id}`}, ${p.name}, ${p.age}, ${p.heightCm}, ${p.cup}, ${p.area},
          ${JSON.stringify(p.tags)}::jsonb, ${p.image}, ${p.online},
          ${p.hourFen}, ${p.nightFen}, ${p.etaMin}, ${JSON.stringify(p.places)}::jsonb,
          ${p.bio}, ${JSON.stringify(p.services)}::jsonb, ${p.work}
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
    where s.id = ${id}
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
    order by s.online desc, s.created_at desc
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
    return rows[0] ? toProfile(rows[0]) : null;
  });

export const saveMyStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => StallInput.parse(data))
  .handler(async ({ context, data }) => {
    if (context.userId.startsWith("seed:")) throw new Error("种子便器不能改");
    const sql = await getSql();
    await ensureSeeded(sql);
    const work = autoWork(data);
    const existing = await sql<{ id: string }>`
      select id from stalls where user_id = ${context.userId} limit 1
    `;
    const id = existing[0]?.id ?? `t${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    if (existing[0]) {
      await sql`
        update stalls set
          name = ${data.name},
          age = ${data.age},
          height_cm = ${data.heightCm},
          cup = ${data.cup},
          area = ${data.area},
          tags = ${JSON.stringify(data.tags)}::jsonb,
          image = ${data.image},
          online = ${data.online},
          hour_fen = ${data.hourFen},
          night_fen = ${data.nightFen},
          eta_min = ${data.etaMin},
          places = ${JSON.stringify(data.places)}::jsonb,
          bio = ${data.bio},
          services = ${JSON.stringify(data.services)}::jsonb,
          work = ${work},
          updated_at = now()
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into stalls (
          id, user_id, name, age, height_cm, cup, area, tags, image, online,
          hour_fen, night_fen, eta_min, places, bio, services, work
        ) values (
          ${id}, ${context.userId}, ${data.name}, ${data.age}, ${data.heightCm}, ${data.cup},
          ${data.area}, ${JSON.stringify(data.tags)}::jsonb, ${data.image}, ${data.online},
          ${data.hourFen}, ${data.nightFen}, ${data.etaMin}, ${JSON.stringify(data.places)}::jsonb,
          ${data.bio}, ${JSON.stringify(data.services)}::jsonb, ${work}
        )
      `;
    }
    const rows = await sql<StallRow>`
      select * from stalls where user_id = ${context.userId} limit 1
    `;
    if (!rows[0]) throw new Error("没写成");
    return toProfile(rows[0]);
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
      name: current.name,
      age: current.age,
      heightCm: current.heightCm,
      cup: current.cup as StallInput["cup"],
      area: current.area,
      tags: current.tags as StallInput["tags"],
      image: current.image,
      online: data.online,
      hourFen: current.hourFen,
      nightFen: current.nightFen,
      etaMin: current.etaMin,
      places: current.places,
      bio: current.bio,
      services: current.services,
      confirmedAdult: true,
    });
    await sql`
      update stalls
      set online = ${data.online}, work = ${work}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ...current, online: data.online, work };
  });


export const PLACE_OPTIONS = PLACE_PRESETS;
export const SERVICE_OPTIONS = SERVICE_PRESETS;
