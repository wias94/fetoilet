import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";

export type AccountRole = "male" | "stall";

export async function isAdminUser(userId: string) {
  const sql = await getSql();
  const users = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1
  `;
  const email = (users[0]?.email ?? "").trim().toLowerCase();
  if (!email) return false;
  const rows = await sql<{ email: string }>`
    select email from admins where lower(email) = ${email} limit 1
  `;
  return Boolean(rows[0]);
}

export async function resolveRole(userId: string): Promise<AccountRole | null> {
  const sql = await getSql();
  await ensureUserState(sql, userId);
  const rows = await sql<{ role: string | null }>`
    select role from user_state where user_id = ${userId} limit 1
  `;
  const existing = rows[0]?.role;
  if (existing === "male" || existing === "stall") return existing;
  const self = await sql<{ id: string }>`
    select id from stalls
    where user_id = ${userId}
      and user_id not like 'held:%'
      and user_id not like 'seed:%'
    limit 1
  `;
  if (self[0]) {
    await sql`update user_state set role = 'stall', updated_at = now() where user_id = ${userId}`;
    return "stall";
  }
  return null;
}

export async function assertRole(userId: string, wanted: AccountRole) {
  if (await isAdminUser(userId)) throw new Error("管理号请走管理台");
  const current = await resolveRole(userId);
  if (!current) {
    const sql = await getSql();
    await sql`update user_state set role = ${wanted}, updated_at = now() where user_id = ${userId}`;
    return wanted;
  }
  if (current !== wanted) {
    throw new Error(
      current === "stall"
        ? "这个邮箱已是肉厕账号，请另用邮箱登录客户端"
        : "这个邮箱已是客户账号，请另用邮箱登录肉厕端",
    );
  }
  return current;
}

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const admin = await isAdminUser(context.userId);
    const role = admin ? null : await resolveRole(context.userId);
    return { role, admin };
  });

export const claimMyRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ role: z.enum(["male", "stall"]) }).parse(data))
  .handler(async ({ context, data }) => {
    if (await isAdminUser(context.userId)) return { role: null as AccountRole | null, admin: true };
    const role = await assertRole(context.userId, data.role);
    return { role, admin: false };
  });
