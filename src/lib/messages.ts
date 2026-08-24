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

function mapThread(
  r: {
    id: string;
    stall_id: string;
    stall_name: string;
    stall_image: string;
    peer_name: string | null;
    last_body: string;
    last_at: string;
    unread: number;
  },
): Thread {
  return {
    id: r.id,
    stallId: r.stall_id,
    stallName: r.stall_name,
    stallImage: r.stall_image,
    peerName: r.peer_name || r.stall_name,
    lastBody: r.last_body,
    lastAt: r.last_at,
    unread: Number(r.unread),
  };
}

export async function openThreadFor(userId: string, stallId: string) {
  const sql = await getSql();
  const stall = await sql<{ id: string; user_id: string }>`
    select id, user_id from stalls where id = ${stallId} limit 1
  `;
  if (!stall[0]) throw new Error("没这人");
  if (stall[0].user_id === userId) throw new Error("不能给自己发");
  const existing = await sql<{ id: string }>`
    select id from conversations
    where stall_id = ${stallId} and seeker_id = ${userId}
    limit 1
  `;
  if (existing[0]) return { id: existing[0].id };
  const id = crypto.randomUUID();
  try {
    await sql`
      insert into conversations (id, stall_id, seeker_id)
      values (${id}, ${stallId}, ${userId})
    `;
    return { id };
  } catch {
    const again = await sql<{ id: string }>`
      select id from conversations
      where stall_id = ${stallId} and seeker_id = ${userId}
      limit 1
    `;
    if (again[0]) return { id: again[0].id };
    throw new Error("没打开对话");
  }
}

export async function listThreadsFor(userId: string): Promise<Thread[]> {
  const sql = await getSql();
  const mineStall = await stallIdFor(userId);
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
        where c.seeker_id = ${userId}
        order by c.last_at desc
        limit 80
      `;
  return rows.map(mapThread);
}

export async function listMessagesFor(userId: string, conversationId: string) {
  const sql = await getSql();
  const mineStall = await stallIdFor(userId);
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
    where c.id = ${conversationId} limit 1
  `;
  if (!conv[0]) throw new Error("没这对话");
  const isSeeker = conv[0].seeker_id === userId;
  const isStall = mineStall === conv[0].stall_id;
  if (!isSeeker && !isStall) throw new Error("不是你的对话");
  if (isSeeker) {
    await sql`update conversations set unread_seeker = 0 where id = ${conversationId}`;
  } else {
    await sql`update conversations set unread_stall = 0 where id = ${conversationId}`;
  }
  const msgs = await sql<{
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
  }>`
    select id, sender_id, body as content, created_at
    from messages
    where conversation_id = ${conversationId}
    order by created_at asc
    limit 200
  `;
  const thread = mapThread({
    id: conv[0].id,
    stall_id: conv[0].stall_id,
    stall_name: conv[0].stall_name,
    stall_image: conv[0].stall_image,
    peer_name: isStall ? conv[0].peer_name || "男性" : conv[0].stall_name,
    last_body: conv[0].last_body,
    last_at: conv[0].last_at,
    unread: 0,
  });
  return {
    thread,
    messages: msgs.map(
      (m): ChatMessage => ({
        id: m.id,
        senderId: m.sender_id,
        body: m.content,
        createdAt: m.created_at,
        mine: m.sender_id === userId,
      }),
    ),
  };
}

export async function sendMessageFor(userId: string, conversationId: string, content: string) {
  const sql = await getSql();
  const mineStall = await stallIdFor(userId);
  const conv = await sql<{ id: string; stall_id: string; seeker_id: string }>`
    select id, stall_id, seeker_id from conversations where id = ${conversationId} limit 1
  `;
  if (!conv[0]) throw new Error("没这对话");
  const isSeeker = conv[0].seeker_id === userId;
  const isStall = mineStall === conv[0].stall_id;
  if (!isSeeker && !isStall) throw new Error("不是你的对话");
  const id = crypto.randomUUID();
  const rows = await sql<{ id: string; sender_id: string; content: string; created_at: string }>`
    insert into messages (id, conversation_id, sender_id, body)
    values (${id}, ${conversationId}, ${userId}, ${content})
    returning id, sender_id, body as content, created_at
  `;
  if (isSeeker) {
    await sql`
      update conversations
      set last_body = ${content}, last_at = now(), unread_stall = unread_stall + 1
      where id = ${conversationId}
    `;
  } else {
    await sql`
      update conversations
      set last_body = ${content}, last_at = now(), unread_seeker = unread_seeker + 1
      where id = ${conversationId}
    `;
  }
  const row = rows[0];
  return {
    id: row?.id ?? id,
    senderId: userId,
    body: content,
    createdAt: row?.created_at ?? new Date().toISOString(),
    mine: true,
  } satisfies ChatMessage;
}
