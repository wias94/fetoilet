import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { findStall } from "@/lib/stalls";

export const INQUIRY_STATUSES = [
  "pending",
  "accepted",
  "arrived",
  "used",
  "rejected",
  "cancelled",
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

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
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  profile_id: string;
  profile_name: string;
  slot: string;
  note: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function toStatus(value: string): InquiryStatus {
  return (INQUIRY_STATUSES as readonly string[]).includes(value)
    ? (value as InquiryStatus)
    : "pending";
}

function toInquiry(row: Row): Inquiry {
  return {
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    slot: row.slot,
    note: row.note,
    status: toStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export const placeInquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await findStall(sql, data.profileId);
    if (!profile) throw new Error("没这具肉便器");
    if (!profile.online) throw new Error("这具便器关着");
    const id = crypto.randomUUID();
    const rows = await sql<Row>`
      insert into inquiries (id, user_id, profile_id, profile_name, slot, note, status)
      values (${id}, ${context.userId}, ${profile.id}, ${profile.name}, ${data.slot}, ${data.note}, 'pending')
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没叫成");
    return toInquiry(rows[0]);
  });

export const listInquiries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select id, profile_id, profile_name, slot, note,
        coalesce(status, 'pending') as status, created_at,
        coalesce(updated_at, created_at) as updated_at
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
      select id, profile_id, profile_name, slot, note,
        coalesce(status, 'pending') as status, created_at,
        coalesce(updated_at, created_at) as updated_at
      from inquiries
      where profile_id = ${mine[0].id}
      order by
        case coalesce(status, 'pending')
          when 'pending' then 0
          when 'accepted' then 1
          when 'arrived' then 2
          else 3
        end,
        created_at desc
      limit 40
    `;
    return rows.map(toInquiry);
  });

const StallAction = z.object({
  id: z.string().min(1),
  action: z.enum(["accept", "reject", "arrive"]),
});

export const actStallInquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => StallAction.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mine = await sql<{ id: string }>`
      select id from stalls where user_id = ${context.userId} limit 1
    `;
    if (!mine[0]) throw new Error("还没登记这具便器");
    const current = await sql<{ status: string }>`
      select coalesce(status, 'pending') as status
      from inquiries
      where id = ${data.id} and profile_id = ${mine[0].id}
      limit 1
    `;
    if (!current[0]) throw new Error("没这单");
    const from = toStatus(current[0].status);
    const next =
      data.action === "accept"
        ? "accepted"
        : data.action === "reject"
          ? "rejected"
          : "arrived";
    if (data.action === "accept" || data.action === "reject") {
      if (from !== "pending") throw new Error("这单已经动过了");
    } else if (from !== "accepted") {
      throw new Error("先接单才能到");
    }
    const rows = await sql<Row>`
      update inquiries
      set status = ${next}, updated_at = now()
      where id = ${data.id} and profile_id = ${mine[0].id}
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没改成");
    return toInquiry(rows[0]);
  });

export const cancelInquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await sql<{ status: string }>`
      select coalesce(status, 'pending') as status
      from inquiries
      where id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    if (!current[0]) throw new Error("没这单");
    if (toStatus(current[0].status) !== "pending") throw new Error("已经接了，取消不了");
    const rows = await sql<Row>`
      update inquiries
      set status = 'cancelled', updated_at = now()
      where id = ${data.id} and user_id = ${context.userId} and coalesce(status, 'pending') = 'pending'
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没取消成");
    return toInquiry(rows[0]);
  });

export const useInquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await sql<{ status: string }>`
      select coalesce(status, 'pending') as status
      from inquiries
      where id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    if (!current[0]) throw new Error("没这单");
    if (toStatus(current[0].status) !== "arrived") throw new Error("便器到了才能用");
    const rows = await sql<Row>`
      update inquiries
      set status = 'used', updated_at = now()
      where id = ${data.id} and user_id = ${context.userId} and coalesce(status, 'pending') = 'arrived'
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没用成");
    return toInquiry(rows[0]);
  });

export function seekerStatusLabel(status: InquiryStatus) {
  switch (status) {
    case "pending":
      return "等人接";
    case "accepted":
      return "便器在过来";
    case "arrived":
      return "便器到了，点使用公厕";
    case "used":
      return "已冲完";
    case "rejected":
      return "它拒了";
    case "cancelled":
      return "你取消了";
  }
}

export function stallStatusLabel(status: InquiryStatus) {
  switch (status) {
    case "pending":
      return "待接";
    case "accepted":
      return "在过去";
    case "arrived":
      return "已到，等人来用";
    case "used":
      return "客人用完了";
    case "rejected":
      return "你拒了";
    case "cancelled":
      return "客人取消了";
  }
}
