import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { holdingCut, splitFen, PLATFORM_ID, PLATFORM_SALE_FEN, PLATFORM_RENT_FEN } from "@/lib/yield";

async function ensureWallet(sql: Sql, userId: string) {
  await sql`
    insert into wallets (user_id, fen) values (${userId}, 0)
    on conflict (user_id) do nothing
  `;
}

export async function ensurePlatform(sql: Sql) {
  await sql`
    insert into "user" (id, name, email, "emailVerified")
    values (${PLATFORM_ID}, '巷厕平台', 'platform@xiangce.app', true)
    on conflict (id) do nothing
  `;
  await ensureWallet(sql, PLATFORM_ID);
}

export async function adoptUnownedToPlatform(sql: Sql) {
  await ensurePlatform(sql);
  await sql`
    update stalls
    set owner_id = ${PLATFORM_ID},
        listed_fen = ${PLATFORM_SALE_FEN},
        hour_fen = ${PLATFORM_RENT_FEN},
        owned_at = coalesce(owned_at, now()),
        updated_at = now()
    where owner_id is null
  `;
}

export async function creditOwner(
  sql: Sql,
  ownerId: string | null | undefined,
  fen: number,
  inquiryId: string,
  note: string,
  kind = "use",
) {
  if (!ownerId || ownerId.startsWith("seed:") || fen <= 0) return 0;
  await ensureWallet(sql, ownerId);
  await sql`update wallets set fen = fen + ${fen} where user_id = ${ownerId}`;
  await sql`
    insert into ledger (id, user_id, fen, kind, ref_id, note)
    values (${crypto.randomUUID()}, ${ownerId}, ${fen}, ${kind}, ${inquiryId}, ${note})
  `;
  return fen;
}

export async function debitUser(
  sql: Sql,
  userId: string,
  fen: number,
  inquiryId: string,
  note: string,
) {
  if (fen <= 0) return 0;
  await ensureWallet(sql, userId);
  const debit = await sql<{ fen: number }>`
    update wallets set fen = fen - ${fen}
    where user_id = ${userId} and fen >= ${fen}
    returning fen
  `;
  if (!debit[0]) throw new Error("余额不够");
  await sql`
    insert into ledger (id, user_id, fen, kind, ref_id, note)
    values (${crypto.randomUUID()}, ${userId}, ${-fen}, 'spend', ${inquiryId}, ${note})
  `;
  return fen;
}

export async function settleUse(
  sql: Sql,
  opts: {
    ownerId: string | null | undefined;
    grossFen: number;
    inquiryId: string;
    stallId?: string;
    stallName: string;
    relation: string | null;
    ownedAt: string | Date | null;
  },
) {
  if (!opts.ownerId || opts.ownerId.startsWith("seed:") || opts.grossFen <= 0) {
    return { ownerFen: 0, platformFen: 0, ownerSharePct: 100, platformSharePct: 0, weeks: 0, family: false };
  }
  const cut = holdingCut(opts.relation, opts.ownedAt);
  const { ownerFen, platformFen } = splitFen(opts.grossFen, cut);
  await creditOwner(
    sql,
    opts.ownerId,
    ownerFen,
    opts.inquiryId,
    `灌 ${opts.stallName} · 主人 ${cut.ownerSharePct}%`,
  );
  if (platformFen > 0) {
    await creditOwner(
      sql,
      PLATFORM_ID,
      platformFen,
      opts.inquiryId,
      `抽成 ${opts.stallName} · 持有第 ${cut.weeks + 1} 周 ${cut.platformSharePct}%`,
      "cut",
    );
  }
  if (cut.weeks >= 1 && opts.stallId && opts.ownerId && opts.ownerId !== PLATFORM_ID) {
    const stall = await sql<{
      listed_fen: number | null;
      hour_fen: number;
      base_hour_fen: number | null;
      relation: string | null;
    }>`
      select listed_fen, hour_fen, base_hour_fen, relation from stalls where id = ${opts.stallId} limit 1
    `;
    if (stall[0] && stall[0].listed_fen == null) {
      const { quoteSaleFen, loadMarket, loadOwnerEcons } = await import("@/lib/pricing");
      const { stallUsage } = await import("@/lib/econ");
      const market = await loadMarket(sql);
      const usage = await stallUsage(sql, [opts.stallId]);
      const econs = await loadOwnerEcons(sql, [opts.ownerId]);
      const fen = quoteSaleFen({
        ownerId: opts.ownerId,
        profile: {
          hourFen: Number(stall[0].base_hour_fen ?? stall[0].hour_fen),
          relation: stall[0].relation,
          holdWeeks: cut.weeks,
          ownerSharePct: cut.ownerSharePct,
        } as import("@/lib/profiles").Profile,
        baseHourFen: Number(stall[0].base_hour_fen ?? stall[0].hour_fen),
        market,
        econ: econs.get(opts.ownerId),
        used7: usage.get(opts.stallId)?.used7 ?? 1,
        usedAll: usage.get(opts.stallId)?.usedAll ?? 1,
      });
      await sql`
        update stalls set listed_fen = ${fen}, updated_at = now()
        where id = ${opts.stallId} and listed_fen is null
      `;
    }
  }
  return { ownerFen, platformFen, ...cut };
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
    z.object({ id: z.string().min(1), fen: z.number().int().min(0).max(1_000_000_000).nullable() }).parse(data),
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
      update stalls set owner_id = ${context.userId}, listed_fen = null, owned_at = now(), updated_at = now()
      where id = ${stall[0].id} and owner_id = ${stall[0].owner_id} and listed_fen = ${price}
      returning id
    `;
    if (!moved[0]) throw new Error("被人买走了");
    return { id: stall[0].id, paid: price };
  });
