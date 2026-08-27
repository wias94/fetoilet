import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeToken(raw: string, prefix: "XC" | "TC") {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith(prefix) ? compact.slice(prefix.length) : compact;
  return `${prefix}-${body}`;
}

export function mintToken(prefix: "XC" | "TC") {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let body = "";
  for (const b of bytes) body += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${body}`;
}

export async function ensureStallToken(sql: Sql, stallId: string) {
  const existing = await sql<{ stall_token: string | null }>`
    select stall_token from stalls where id = ${stallId} limit 1
  `;
  if (existing[0]?.stall_token) return existing[0].stall_token;
  for (let i = 0; i < 6; i += 1) {
    const token = mintToken("TC");
    try {
      await sql`update stalls set stall_token = ${token} where id = ${stallId} and stall_token is null`;
      const again = await sql<{ stall_token: string | null }>`
        select stall_token from stalls where id = ${stallId} limit 1
      `;
      if (again[0]?.stall_token) return again[0].stall_token;
    } catch {
      /* retry */
    }
  }
  throw new Error("便器口令没做成");
}

export const getMyOwnerToken = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (context.userId.startsWith("seed:")) throw new Error("种子号没有口令");
    const sql = await getSql();
    const existing = await sql<{ token: string }>`
      select token from owner_tokens where user_id = ${context.userId} limit 1
    `;
    if (existing[0]) return { token: existing[0].token };
    for (let i = 0; i < 6; i += 1) {
      const token = mintToken("XC");
      try {
        await sql`
          insert into owner_tokens (user_id, token) values (${context.userId}, ${token})
        `;
        return { token };
      } catch {
        const raced = await sql<{ token: string }>`
          select token from owner_tokens where user_id = ${context.userId} limit 1
        `;
        if (raced[0]) return { token: raced[0].token };
      }
    }
    throw new Error("口令没做成");
  });

export async function lookupOwnerId(tokenRaw: string) {
  const sql = await getSql();
  const token = normalizeToken(tokenRaw, "XC");
  if (token.length < 8) throw new Error("所有者口令不对");
  const rows = await sql<{ user_id: string }>`
    select user_id from owner_tokens where token = ${token} limit 1
  `;
  if (!rows[0]) throw new Error("所有者口令不对");
  if (rows[0].user_id === "seed:owner") throw new Error("这串口令不能用");
  return rows[0].user_id;
}

export const claimByStallToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ token: z.string().trim().min(6).max(24) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const token = normalizeToken(data.token, "TC");
    const stall = await sql<{ id: string; name: string; owner_id: string | null }>`
      select id, name, owner_id from stalls where stall_token = ${token} limit 1
    `;
    if (!stall[0]) throw new Error("便器口令不对");
    if (stall[0].owner_id) throw new Error("这具已有主，去买");
    const taken = await sql<{ id: string }>`
      update stalls set owner_id = ${context.userId}, listed_fen = null, owned_at = now(), updated_at = now()
      where id = ${stall[0].id} and owner_id is null
      returning id
    `;
    if (!taken[0]) throw new Error("被人抢先收编了");
    return { id: stall[0].id, name: stall[0].name };
  });

export type ClaimRow = {
  id: string;
  stallId: string;
  stallName: string;
  status: string;
  createdAt: string;
};

export const requestOwnership = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ inquiryId: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stall = await sql<{ id: string; owner_id: string | null }>`
      select id, owner_id from stalls where user_id = ${context.userId} limit 1
    `;
    if (!stall[0]) throw new Error("还没登记这具便器");
    if (stall[0].owner_id) throw new Error("已经有主了");
    const inquiry = await sql<{ id: string; user_id: string; status: string }>`
      select id, user_id, coalesce(status, 'pending') as status
      from inquiries
      where id = ${data.inquiryId} and profile_id = ${stall[0].id}
      limit 1
    `;
    if (!inquiry[0] || inquiry[0].status !== "used") throw new Error("灌完才能求他收编");
    const dup = await sql<{ id: string }>`
      select id from claim_requests
      where stall_id = ${stall[0].id} and male_id = ${inquiry[0].user_id} and status = 'pending'
      limit 1
    `;
    if (dup[0]) return { id: dup[0].id, already: true };
    const id = crypto.randomUUID();
    await sql`
      insert into claim_requests (id, stall_id, male_id, inquiry_id, status)
      values (${id}, ${stall[0].id}, ${inquiry[0].user_id}, ${inquiry[0].id}, 'pending')
    `;
    return { id, already: false };
  });

export const listClaimRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; stall_id: string; name: string; status: string; created_at: string }>`
      select c.id, c.stall_id, s.name, c.status, c.created_at
      from claim_requests c
      join stalls s on s.id = c.stall_id
      where c.male_id = ${context.userId} and c.status = 'pending'
      order by c.created_at desc
      limit 20
    `;
    return rows.map((r) => ({
      id: r.id,
      stallId: r.stall_id,
      stallName: r.name,
      status: r.status,
      createdAt: r.created_at,
    })) satisfies ClaimRow[];
  });

export const answerClaim = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1), accept: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await sql<{ id: string; stall_id: string; owner_id: string | null }>`
      select c.id, c.stall_id, s.owner_id
      from claim_requests c
      join stalls s on s.id = c.stall_id
      where c.id = ${data.id} and c.male_id = ${context.userId} and c.status = 'pending'
      limit 1
    `;
    if (!row[0]) throw new Error("没这条求收编");
    if (!data.accept) {
      await sql`update claim_requests set status = 'declined' where id = ${row[0].id}`;
      return { ok: true, owned: false };
    }
    if (row[0].owner_id) {
      await sql`update claim_requests set status = 'declined' where id = ${row[0].id}`;
      throw new Error("已经有主了");
    }
    const taken = await sql<{ id: string }>`
      update stalls set owner_id = ${context.userId}, listed_fen = null, owned_at = now(), updated_at = now()
      where id = ${row[0].stall_id} and owner_id is null
      returning id
    `;
    if (!taken[0]) throw new Error("被人抢先收编了");
    await sql`update claim_requests set status = 'accepted' where id = ${row[0].id}`;
    return { ok: true, owned: true };
  });

export const claimAfterUse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ inquiryId: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const inquiry = await sql<{ id: string; profile_id: string; status: string }>`
      select id, profile_id, coalesce(status, 'pending') as status
      from inquiries
      where id = ${data.inquiryId} and user_id = ${context.userId}
      limit 1
    `;
    if (!inquiry[0] || inquiry[0].status !== "used") throw new Error("冲完才能收编");
    const stall = await sql<{ id: string; name: string; owner_id: string | null }>`
      select id, name, owner_id from stalls where id = ${inquiry[0].profile_id} limit 1
    `;
    if (!stall[0]) throw new Error("没这具");
    if (stall[0].owner_id) throw new Error("这具已有主");
    const taken = await sql<{ id: string }>`
      update stalls set owner_id = ${context.userId}, listed_fen = null, owned_at = now(), updated_at = now()
      where id = ${stall[0].id} and owner_id is null
      returning id
    `;
    if (!taken[0]) throw new Error("被人抢先收编了");
    return { id: stall[0].id, name: stall[0].name };
  });
