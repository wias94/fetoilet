import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { ADMIN_EMAIL } from "@/lib/auth/login-email";

export const ADMIN_PASSWORD = "P@ssw0rd";

export async function ensureAdminAccount() {
  const sql = await getSql();
  await sql`
    insert into admins (email) values (${ADMIN_EMAIL})
    on conflict (email) do nothing
  `;
  await sql`delete from admins where lower(email) = ${"wiwiiasama@gmail.com"}`;
  const existing = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${ADMIN_EMAIL} limit 1
  `;
  const hash = await hashPassword(ADMIN_PASSWORD);
  if (existing[0]) {
    const updated = await sql<{ id: string }>`
      update account
      set password = ${hash}, "updatedAt" = now()
      where "userId" = ${existing[0].id} and "providerId" = 'credential'
      returning id
    `;
    if (!updated[0]) {
      const accountId = crypto.randomUUID().replaceAll("-", "");
      await sql`
        insert into account (
          id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
        ) values (
          ${accountId}, ${existing[0].id}, 'credential', ${existing[0].id}, ${hash}, now(), now()
        )
      `;
    }
    return { id: existing[0].id };
  }
  const id = "admin";
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${"admin"}, ${ADMIN_EMAIL}, true, now(), now())
  `;
  const accountId = crypto.randomUUID().replaceAll("-", "");
  await sql`
    insert into account (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    ) values (
      ${accountId}, ${id}, 'credential', ${id}, ${hash}, now(), now()
    )
  `;
  return { id };
}
