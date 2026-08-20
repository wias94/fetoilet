import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { findStall } from "@/lib/stalls";

const Input = z.object({
  profileId: z.string(),
  slot: z.string().min(1).max(20),
  note: z.string().max(80).default(""),
});

export type Inquiry = {
  id: string;
  profileId: string;
  profileName: string;
  slot: string;
  note: string;
  createdAt: string;
};

type Row = {
  id: string;
  profile_id: string;
  profile_name: string;
  slot: string;
  note: string;
  created_at: string;
};

function toInquiry(row: Row): Inquiry {
  return {
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    slot: row.slot,
    note: row.note,
    createdAt: row.created_at,
  };
}

export const placeInquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await findStall(sql, data.profileId);
    if (!profile) throw new Error("没这具肉便器");
    const id = crypto.randomUUID();
    await sql`
      insert into inquiries (id, user_id, profile_id, profile_name, slot, note)
      values (${id}, ${context.userId}, ${profile.id}, ${profile.name}, ${data.slot}, ${data.note})
    `;
    return {
      id,
      profileId: profile.id,
      profileName: profile.name,
      slot: data.slot,
      note: data.note,
      createdAt: new Date().toISOString(),
    } satisfies Inquiry;
  });

export const listInquiries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select id, profile_id, profile_name, slot, note, created_at
      from inquiries
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows.map(toInquiry);
  });

export const listStallInquiries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const mine = await sql<{ id: string }>`
      select id from stalls where user_id = ${context.userId} limit 1
    `;
    if (!mine[0]) return [] as Inquiry[];
    const rows = await sql<Row>`
      select id, profile_id, profile_name, slot, note, created_at
      from inquiries
      where profile_id = ${mine[0].id}
      order by created_at desc
      limit 40
    `;
    return rows.map(toInquiry);
  });
