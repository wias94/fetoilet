import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

async function ensureWallet(sql: Sql, userId: string) {
  await sql`
    insert into wallets (user_id, fen) values (${userId}, 0)
    on conflict (user_id) do nothing
  `;
}

export async function creditOwner(
  sql: Sql,
  ownerId: string | null | undefined,
  fen: number,
  inquiryId: string,
  note: string,
) {
  if (!ownerId || ownerId.startsWith("seed:") || fen <= 0) return 0;
  await ensureWallet(sql, ownerId);
  await sql`update wallets set fen = fen + ${fen} where user_id = ${ownerId}`;
  await sql`
    insert into ledger (id, user_id, fen, kind, ref_id, note)
    values (${crypto.randomUUID()}, ${ownerId}, ${fen}, 'use', ${inquiryId}, ${note})
  `;
  return fen;
}

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureWallet(sql, context.userId);
    const rows = await sql<{ fen: number }>`
      select fen from wallets where user_id = ${context.userId} limit 1
    `;
    return { fen: Number(rows[0]?.fen ?? 0) };
  });

export const listMyLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; fen: number; kind: string; note: string; created_at: string }>`
      select id, fen, kind, note, created_at
      from ledger
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `;
    return rows.map((r) => ({
      id: r.id,
      fen: Number(r.fen),
      kind: r.kind,
      note: r.note,
      createdAt: r.created_at,
    }));
  });

export const setStallListed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1), fen: z.number().int().min(0).max(800000).nullable() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mine = await sql<{ id: string }>`
      select id from stalls where id = ${data.id} and owner_id = ${context.userId} limit 1
    `;
    if (!mine[0]) throw new Error("这具不是你的货");
    await sql`
      update stalls set listed_fen = ${data.fen}, updated_at = now()
      where id = ${data.id} and owner_id = ${context.userId}
    `;
    return { id: data.id, listedFen: data.fen };
  });

export const buyStall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stall = await sql<{ id: string; name: string; owner_id: string | null; listed_fen: number | null }>`
      select id, name, owner_id, listed_fen from stalls where id = ${data.id} limit 1
    `;
    if (!stall[0]) throw new Error("没这具");
    const price = Number(stall[0].listed_fen ?? 0);
    if (!stall[0].owner_id || stall[0].owner_id.startsWith("seed:")) throw new Error("这具不卖");
    if (!price) throw new Error("主人没挂牌");
    if (stall[0].owner_id === context.userId) throw new Error("已经是你的货");
    await ensureWallet(sql, context.userId);
    await ensureWallet(sql, stall[0].owner_id);
    const mine = await sql<{ fen: number }>`
      select fen from wallets where user_id = ${context.userId} limit 1
    `;
    if (Number(mine[0]?.fen ?? 0) < price) throw new Error("余额不够");
    const debit = await sql<{ fen: number }>`
      update wallets set fen = fen - ${price}
      where user_id = ${context.userId} and fen >= ${price}
      returning fen
    `;
    if (!debit[0]) throw new Error("余额不够");
    await sql`update wallets set fen = fen + ${price} where user_id = ${stall[0].owner_id}`;
    await sql`
      insert into ledger (id, user_id, fen, kind, ref_id, note)
      values (${crypto.randomUUID()}, ${context.userId}, ${-price}, 'buy', ${stall[0].id}, ${`买下 ${stall[0].name}`})
    `;
    await sql`
      insert into ledger (id, user_id, fen, kind, ref_id, note)
      values (${crypto.randomUUID()}, ${stall[0].owner_id}, ${price}, 'sell', ${stall[0].id}, ${`卖掉 ${stall[0].name}`})
    `;
    const moved = await sql<{ id: string }>`
      update stalls set owner_id = ${context.userId}, listed_fen = null, updated_at = now()
      where id = ${stall[0].id} and owner_id = ${stall[0].owner_id} and listed_fen = ${price}
      returning id
    `;
    if (!moved[0]) throw new Error("被人买走了");
    return { id: stall[0].id, paid: price };
  });
