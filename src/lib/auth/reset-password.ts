import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

const Input = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
});

export const resetEmailPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const users = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${data.email} limit 1
    `;
    if (!users[0]) throw new Error("这个邮箱还没注册");
    const hash = await hashPassword(data.password);
    const updated = await sql<{ id: string }>`
      update account
      set password = ${hash}, "updatedAt" = now()
      where "userId" = ${users[0].id} and "providerId" = 'credential'
      returning id
    `;
    if (!updated[0]) throw new Error("这个邮箱不是密码注册的");
    return { ok: true as const };
  });
