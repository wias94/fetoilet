import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type FeedPost = {
  id: string;
  stallId: string;
  stallName: string;
  stallImage: string;
  online: boolean;
  body: string;
  createdAt: string;
  mine: boolean;
};

export const listFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FeedPost[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      stall_id: string;
      stall_name: string;
      stall_image: string;
      online: boolean;
      body: string;
      created_at: string;
      user_id: string;
    }>`
      select p.id, p.stall_id, s.name as stall_name, s.image as stall_image,
        s.online, p.body, p.created_at, p.user_id
      from posts p
      join stalls s on s.id = p.stall_id
      where coalesce(s.hidden, false) = false
      order by p.created_at desc
      limit 80
    `;
    return rows.map((r) => ({
      id: r.id,
      stallId: r.stall_id,
      stallName: r.stall_name,
      stallImage: r.stall_image,
      online: Boolean(r.online),
      body: r.body,
      createdAt: r.created_at,
      mine: r.user_id === context.userId,
    }));
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ body: z.string().trim().min(1).max(280) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stall = await sql<{ id: string }>`
      select id from stalls where user_id = ${context.userId} limit 1
    `;
    if (!stall[0]) throw new Error("先登记成女性再发动态");
    const id = crypto.randomUUID();
    await sql`
      insert into posts (id, stall_id, user_id, body)
      values (${id}, ${stall[0].id}, ${context.userId}, ${data.body})
    `;
    return { id };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      delete from posts where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) throw new Error("删不了");
    return { ok: true as const };
  });
