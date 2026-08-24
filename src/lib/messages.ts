import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type Thread = {
  id: string;
  stallId: string;
  stallName: string;
  stallImage: string;
  peerName: string;
  lastBody: string;
  lastAt: string;
  unread: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

async function stallIdFor(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`select id from stalls where user_id = ${userId} limit 1`;
  return rows[0]?.id ?? null;
}

export const openThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ stallId: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stall = await sql<{ id: string; user_id: string; name: string }>`
      select id, user_id, name from stalls where id = ${data.stallId} limit 1
    `;
    if (!stall[0]) throw new Error("没这人");
    if (stall[0].user_id === context.userId) throw new Error("不能给自己发");
    const existing = await sql<{ id: string }>`
      select id from conversations
      where stall_id = ${data.stallId} and seeker_id = ${context.userId}
      limit 1
    `;
    if (existing[0]) return { id: existing[0].id };
    const id = crypto.randomUUID();
    await sql`
      insert into conversations (id, stall_id, seeker_id)
      values (${id}, ${data.stallId}, ${context.userId})
    `;
    return { id };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Thread[]> => {
    const sql = await getSql();
    const mineStall = await stallIdFor(context.userId);
    const rows = mineStall
      ? await sql<{
          id: string;
          stall_id: string;
          stall_name: string;
          stall_image: string;
          peer_name: string | null;
          last_body: string;
          last_at: string;
          unread: number;
        }>`
          select c.id, c.stall_id, s.name as stall_name, s.image as stall_image,
            u.name as peer_name, c.last_body, c.last_at, c.unread_stall as unread
          from conversations c
          join stalls s on s.id = c.stall_id
          left join "user" u on u.id = c.seeker_id
          where c.stall_id = ${mineStall}
          order by c.last_at desc
          limit 80
        `
      : await sql<{
          id: string;
          stall_id: string;
          stall_name: string;
          stall_image: string;
          peer_name: string | null;
          last_body: string;
          last_at: string;
          unread: number;
        }>`
          select c.id, c.stall_id, s.name as stall_name, s.image as stall_image,
            s.name as peer_name, c.last_body, c.last_at, c.unread_seeker as unread
          from conversations c
          join stalls s on s.id = c.stall_id
          where c.seeker_id = ${context.userId}
          order by c.last_at desc
          limit 80
        `;
    return rows.map((r) => ({
      id: r.id,
      stallId: r.stall_id,
      stallName: r.stall_name,
      stallImage: r.stall_image,
      peerName: r.peer_name || r.stall_name,
      lastBody: r.last_body,
      lastAt: r.last_at,
      unread: Number(r.unread),
    }));
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }): Promise<{ thread: Thread; messages: ChatMessage[] }> => {
    const sql = await getSql();
    const mineStall = await stallIdFor(context.userId);
    const conv = await sql<{
      id: string;
      stall_id: string;
      seeker_id: string;
      stall_name: string;
      stall_image: string;
      peer_name: string | null;
      last_body: string;
      last_at: string;
      unread_seeker: number;
      unread_stall: number;
    }>`
      select c.id, c.stall_id, c.seeker_id, s.name as stall_name, s.image as stall_image,
        u.name as peer_name, c.last_body, c.last_at, c.unread_seeker, c.unread_stall
      from conversations c
      join stalls s on s.id = c.stall_id
      left join "user" u on u.id = c.seeker_id
      where c.id = ${data.id} limit 1
    `;
    if (!conv[0]) throw new Error("没这对话");
    const isSeeker = conv[0].seeker_id === context.userId;
    const isStall = mineStall === conv[0].stall_id;
    if (!isSeeker && !isStall) throw new Error("不是你的对话");
    if (isSeeker) {
      await sql`update conversations set unread_seeker = 0 where id = ${data.id}`;
    } else {
      await sql`update conversations set unread_stall = 0 where id = ${data.id}`;
    }
    const msgs = await sql<{
      id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }>`
      select id, sender_id, body, created_at
      from messages
      where conversation_id = ${data.id}
      order by created_at asc
      limit 200
    `;
    const thread: Thread = {
      id: conv[0].id,
      stallId: conv[0].stall_id,
      stallName: conv[0].stall_name,
      stallImage: conv[0].stall_image,
      peerName: isStall ? conv[0].peer_name || "男性" : conv[0].stall_name,
      lastBody: conv[0].last_body,
      lastAt: conv[0].last_at,
      unread: 0,
    };
    return {
      thread,
      messages: msgs.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        body: m.body,
        createdAt: m.created_at,
        mine: m.sender_id === context.userId,
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1), body: z.string().trim().min(1).max(500) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mineStall = await stallIdFor(context.userId);
    const conv = await sql<{ id: string; stall_id: string; seeker_id: string }>`
      select id, stall_id, seeker_id from conversations where id = ${data.id} limit 1
    `;
    if (!conv[0]) throw new Error("没这对话");
    const isSeeker = conv[0].seeker_id === context.userId;
    const isStall = mineStall === conv[0].stall_id;
    if (!isSeeker && !isStall) throw new Error("不是你的对话");
    const id = crypto.randomUUID();
    await sql`
      insert into messages (id, conversation_id, sender_id, body)
      values (${id}, ${data.id}, ${context.userId}, ${data.body})
    `;
    if (isSeeker) {
      await sql`
        update conversations
        set last_body = ${data.body}, last_at = now(), unread_stall = unread_stall + 1
        where id = ${data.id}
      `;
    } else {
      await sql`
        update conversations
        set last_body = ${data.body}, last_at = now(), unread_seeker = unread_seeker + 1
        where id = ${data.id}
      `;
    }
    return {
      id,
      senderId: context.userId,
      body: data.body,
      createdAt: new Date().toISOString(),
      mine: true,
    } satisfies ChatMessage;
  });
