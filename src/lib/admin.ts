import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/auth/admin-middleware";
import { getSql } from "@/lib/db";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  stallId: string | null;
  stallName: string | null;
};

export type AdminStallRow = {
  id: string;
  userId: string;
  name: string;
  area: string;
  online: boolean;
  featured: boolean;
  hidden: boolean;
  hourFen: number;
  createdAt: string;
};

export type AdminOrderRow = {
  id: string;
  profileId: string;
  profileName: string;
  slot: string;
  status: string;
  createdAt: string;
};

export type AdminReviewRow = {
  id: string;
  profileId: string;
  score: number;
  comment: string;
  createdAt: string;
};

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "seeker" | "stall";
  active: boolean;
  createdAt: string;
};

export type AdminOverview = {
  users: number;
  stalls: number;
  online: number;
  orders: number;
  used: number;
  reviews: number;
};

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<AdminOverview> => {
    const sql = await getSql();
    const users = await sql<{ n: number }>`select count(*)::int as n from "user"`;
    const stalls = await sql<{ n: number; online: number }>`
      select count(*)::int as n, count(*) filter (where online)::int as online from stalls
    `;
    const orders = await sql<{ n: number; used: number }>`
      select count(*)::int as n,
        count(*) filter (where coalesce(status, 'pending') = 'used')::int as used
      from inquiries
    `;
    const reviews = await sql<{ n: number }>`select count(*)::int as n from reviews`;
    return {
      users: Number(users[0]?.n ?? 0),
      stalls: Number(stalls[0]?.n ?? 0),
      online: Number(stalls[0]?.online ?? 0),
      orders: Number(orders[0]?.n ?? 0),
      used: Number(orders[0]?.used ?? 0),
      reviews: Number(reviews[0]?.n ?? 0),
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      createdAt: string;
      stall_id: string | null;
      stall_name: string | null;
    }>`
      select u.id, u.name, u.email, u."createdAt",
        s.id as stall_id, s.name as stall_name
      from "user" u
      left join stalls s on s.user_id = u.id
      order by u."createdAt" desc
      limit 200
    `;
    return rows.map(
      (r): AdminUserRow => ({
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: String(r.createdAt),
        stallId: r.stall_id,
        stallName: r.stall_name,
      }),
    );
  });

export const adminListStalls = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      user_id: string;
      name: string;
      area: string;
      online: boolean;
      featured: boolean;
      hidden: boolean;
      hour_fen: number;
      created_at: string;
    }>`
      select id, user_id, name, area, online,
        coalesce(featured, false) as featured,
        coalesce(hidden, false) as hidden,
        hour_fen, created_at
      from stalls
      order by coalesce(featured, false) desc, created_at desc
      limit 200
    `;
    return rows.map(
      (r): AdminStallRow => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        area: r.area,
        online: Boolean(r.online),
        featured: Boolean(r.featured),
        hidden: Boolean(r.hidden),
        hourFen: Number(r.hour_fen),
        createdAt: String(r.created_at),
      }),
    );
  });

export const adminPatchStall = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        online: z.boolean().optional(),
        featured: z.boolean().optional(),
        hidden: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const current = await sql<{ id: string }>`select id from stalls where id = ${data.id} limit 1`;
    if (!current[0]) throw new Error("没这具货");
    if (data.online !== undefined) {
      await sql`update stalls set online = ${data.online}, updated_at = now() where id = ${data.id}`;
    }
    if (data.featured !== undefined) {
      await sql`update stalls set featured = ${data.featured}, updated_at = now() where id = ${data.id}`;
    }
    if (data.hidden !== undefined) {
      await sql`update stalls set hidden = ${data.hidden}, updated_at = now() where id = ${data.id}`;
    }
    return { ok: true as const };
  });

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      profile_id: string;
      profile_name: string;
      slot: string;
      status: string;
      created_at: string;
    }>`
      select id, profile_id, profile_name, slot,
        coalesce(status, 'pending') as status, created_at
      from inquiries
      order by created_at desc
      limit 200
    `;
    return rows.map(
      (r): AdminOrderRow => ({
        id: r.id,
        profileId: r.profile_id,
        profileName: r.profile_name,
        slot: r.slot,
        status: r.status,
        createdAt: String(r.created_at),
      }),
    );
  });

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      profile_id: string;
      score: number;
      comment: string;
      created_at: string;
    }>`
      select id, profile_id, score, comment, created_at
      from reviews
      order by created_at desc
      limit 200
    `;
    return rows.map(
      (r): AdminReviewRow => ({
        id: r.id,
        profileId: r.profile_id,
        score: Number(r.score),
        comment: r.comment,
        createdAt: String(r.created_at),
      }),
    );
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from reviews where id = ${data.id}`;
    return { ok: true as const };
  });

function toBroadcast(row: {
  id: string;
  title: string;
  body: string;
  audience: string;
  active: boolean;
  created_at: string;
}): Broadcast {
  const audience =
    row.audience === "seeker" || row.audience === "stall" ? row.audience : "all";
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

export const adminListBroadcasts = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      body: string;
      audience: string;
      active: boolean;
      created_at: string;
    }>`
      select id, title, body, audience, active, created_at
      from broadcasts
      order by created_at desc
      limit 40
    `;
    return rows.map(toBroadcast);
  });

export const adminPushBroadcast = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(40),
        body: z.string().trim().min(1).max(200),
        audience: z.enum(["all", "seeker", "stall"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into broadcasts (id, title, body, audience, active)
      values (${id}, ${data.title}, ${data.body}, ${data.audience}, true)
    `;
    return { id };
  });

export const adminToggleBroadcast = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update broadcasts set active = ${data.active} where id = ${data.id}`;
    return { ok: true as const };
  });

export const listActiveBroadcast = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ audience: z.enum(["seeker", "stall"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      body: string;
      audience: string;
      active: boolean;
      created_at: string;
    }>`
      select id, title, body, audience, active, created_at
      from broadcasts
      where active = true
        and (audience = 'all' or audience = ${data.audience})
      order by created_at desc
      limit 1
    `;
    return rows[0] ? toBroadcast(rows[0]) : null;
  });
