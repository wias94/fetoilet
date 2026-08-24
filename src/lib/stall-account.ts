import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";
import { ADMIN_EMAIL } from "@/lib/auth/login-email";

export function mintLoginPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = crypto.getRandomValues(new Uint8Array(10));
  let out = "";
  for (const b of buf) out += chars[b % chars.length];
  return out;
}

export async function createStallLogin(email: string, name: string, ownerUserId: string) {
  const mail = email.trim().toLowerCase();
  if (!mail.includes("@")) throw new Error("请填写有效邮箱");
  if (mail === ADMIN_EMAIL) throw new Error("这个邮箱不能用");
  const sql = await getSql();
  const owner = await sql<{ email: string | null }>`
    select email from "user" where id = ${ownerUserId} limit 1
  `;
  if ((owner[0]?.email ?? "").trim().toLowerCase() === mail) {
    throw new Error("不能用自己的邮箱给肉厕登录");
  }
  const taken = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${mail} limit 1
  `;
  if (taken[0]) throw new Error("这个邮箱已经注册");
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 32);
  const password = mintLoginPassword();
  const hash = await hashPassword(password);
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${name}, ${mail}, true, now(), now())
  `;
  const accountId = crypto.randomUUID().replaceAll("-", "");
  await sql`
    insert into account (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    ) values (
      ${accountId}, ${id}, 'credential', ${id}, ${hash}, now(), now()
    )
  `;
  await ensureUserState(sql, id);
  await sql`update user_state set role = 'stall', updated_at = now() where user_id = ${id}`;
  return { userId: id, email: mail, password };
}
