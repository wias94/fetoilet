import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";

export const getMyMaleAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUserState(sql, context.userId);
    const rows = await sql<{ name: string | null; age: number | null }>`
      select u.name, s.age
      from "user" u
      join user_state s on s.user_id = u.id
      where u.id = ${context.userId}
      limit 1
    `;
    return { name: rows[0]?.name ?? "", age: rows[0]?.age ?? null };
  });

export const saveMyMaleAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(16),
        age: z.number().int().min(18).max(80),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertRole } = await import("@/lib/roles");
    await assertRole(context.userId, "male");
    const sql = await getSql();
    await ensureUserState(sql, context.userId);
    await sql`update "user" set name = ${data.name}, "updatedAt" = now() where id = ${context.userId}`;
    await sql`update user_state set age = ${data.age}, updated_at = now() where user_id = ${context.userId}`;
    return { name: data.name, age: data.age };
  });
