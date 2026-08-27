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
    const { assertRole } = await import("@/lib/roles");
    await assertRole(context.userId, "male");
    const sql = await getSql();
    const { releaseExpiredRentals, lockRental, unlockRental } = await import("@/lib/occupancy");
    await releaseExpiredRentals(sql);
    const profile = await findStall(sql, data.profileId);
    if (!profile) throw new Error("没这具肉便器");
    if (!profile.online) throw new Error("所属人已让这具休息，暂不出租");
    if (profile.busy) throw new Error("使用中，先到先得");
    const { refreshUserFromSim } = await import("@/lib/location-sim");
    const { getUserState } = await import("@/lib/behavior");
    const { distanceM, NEARBY_RADIUS_M } = await import("@/lib/geo");
    await refreshUserFromSim(context.userId);
    const state = await getUserState(context.userId);
    const lat = state?.location?.lat;
    const lng = state?.location?.lng;
    if (lat == null || lng == null) throw new Error("先开定位，只能点附近 3 公里内的肉厕");
    const here = await sql<{ lat: number | null; lng: number | null }>`
      select lat, lng from stalls where id = ${profile.id} limit 1
    `;
    const slat = here[0]?.lat;
    const slng = here[0]?.lng;
    if (slat == null || slng == null) throw new Error("这具肉厕还没有位置，不能点");
    const far = distanceM(lat, lng, Number(slat), Number(slng));
    if (far > NEARBY_RADIUS_M) throw new Error(`超出 3 公里（现在 ${Math.round(far)} 米），只能点附近的`);
    const id = crypto.randomUUID();
    const locked = await lockRental(sql, profile.id, id);
    if (!locked) throw new Error("被人先点了。使用中 30 分钟内货架不可见");
    const rows = await sql<Row>`
      insert into inquiries (id, user_id, profile_id, profile_name, slot, note, status)
      values (${id}, ${context.userId}, ${profile.id}, ${profile.name}, ${data.slot}, ${data.note}, 'accepted')
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) {
      await unlockRental(sql, id);
      throw new Error("没叫成");
    }
    const { recordEvent } = await import("@/lib/behavior");
    await recordEvent({
      userId: context.userId,
      kind: "inquiry_place",
      targetId: profile.id,
      payload: { slot: data.slot },
    });
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
          when 'used' then 3
          else 4
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

export const listOwnerInquiries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select i.id, i.profile_id, i.profile_name, i.slot, i.note,
        coalesce(i.status, 'pending') as status, i.created_at,
        coalesce(i.updated_at, i.created_at) as updated_at
      from inquiries i
      join stalls s on s.id = i.profile_id
      where s.owner_id = ${context.userId}
      order by
        case coalesce(i.status, 'pending')
          when 'pending' then 0
          when 'accepted' then 1
          when 'arrived' then 2
          when 'used' then 3
          else 4
        end,
        i.created_at desc
      limit 40
    `;
    return rows.map(toInquiry);
  });

export const actOwnerInquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => StallAction.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await sql<{ status: string; profile_id: string }>`
      select coalesce(i.status, 'pending') as status, i.profile_id
      from inquiries i
      join stalls s on s.id = i.profile_id
      where i.id = ${data.id} and s.owner_id = ${context.userId}
      limit 1
    `;
    if (!current[0]) throw new Error("没这单");
    const from = toStatus(current[0].status);
    if (data.action === "reject") throw new Error("挂牌出租必须接单，不能拒");
    if (data.action === "accept") throw new Error("出租单自动接，不用再点");
    if (from !== "accepted") throw new Error("先到点「已到位」");
    const next = "arrived";
    const rows = await sql<Row>`
      update inquiries
      set status = ${next}, updated_at = now()
      where id = ${data.id}
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没改成");
    return toInquiry(rows[0]);
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
    if (data.action === "reject") throw new Error("挂牌出租必须接单，不能拒");
    if (data.action === "accept") throw new Error("出租单自动接，不用再点");
    if (from !== "accepted") throw new Error("先到位才能标到了");
    const next = "arrived";
    const rows = await sql<Row>`
      update inquiries
      set status = ${next}, updated_at = now()
      where id = ${data.id} and profile_id = ${mine[0].id}
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没改成");
    const { recordEvent } = await import("@/lib/behavior");
    await recordEvent({
      userId: context.userId,
      kind: "inquiry_arrive",
      targetId: rows[0].id,
    });
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
    const from = toStatus(current[0].status);
    if (from !== "pending" && from !== "accepted") throw new Error("已经在使用，取消不了");
    const rows = await sql<Row>`
      update inquiries
      set status = 'cancelled', updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
        and coalesce(status, 'pending') in ('pending', 'accepted')
      returning id, profile_id, profile_name, slot, note, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("没取消成");
    const { unlockRental } = await import("@/lib/occupancy");
    await unlockRental(sql, rows[0].id);
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
    const stall = await sql<{
      owner_id: string | null;
      hour_fen: number;
      base_hour_fen: number | null;
      name: string;
      relation: string | null;
      owned_at: string | null;
    }>`
      select owner_id, hour_fen, base_hour_fen, name, relation, owned_at from stalls where id = ${rows[0].profile_id} limit 1
    `;
    if (stall[0]) {
      const ownerId = stall[0].owner_id;
      const selfUse = Boolean(ownerId && ownerId === context.userId);
      if (!selfUse) {
        const { quoteStallNow } = await import("@/lib/pricing");
        const grossFen = await quoteStallNow(sql, { ...stall[0], id: rows[0].profile_id });
        const { settleUse } = await import("@/lib/economy");
        await settleUse(sql, {
          ownerId,
          grossFen,
          inquiryId: rows[0].id,
          stallId: rows[0].profile_id,
          stallName: stall[0].name,
          relation: stall[0].relation,
          ownedAt: stall[0].owned_at,
        });
      }
    }
    const { recordEvent } = await import("@/lib/behavior");
    await recordEvent({
      userId: context.userId,
      kind: "inquiry_use",
      targetId: rows[0].profile_id,
      payload: { free: Boolean(stall[0]?.owner_id && stall[0].owner_id === context.userId) },
    });
    const { bumpSatiation } = await import("@/lib/occupancy");
    await bumpSatiation(
      sql,
      context.userId,
      rows[0].profile_id,
      stall[0]?.owner_id === context.userId ? 1 : 1,
    );
    return toInquiry(rows[0]);
  });

export function seekerStatusLabel(status: InquiryStatus) {
  switch (status) {
    case "pending":
      return "待接单";
    case "accepted":
      return "已锁定出租 30 分钟，肉厕正在前往";
    case "arrived":
      return "肉厕已到位，请确认使用";
    case "used":
      return "使用已完成";
    case "rejected":
      return "已拒绝";
    case "cancelled":
      return "已取消";
  }
}

export function stallStatusLabel(status: InquiryStatus) {
  switch (status) {
    case "pending":
      return "待本厕接单";
    case "accepted":
      return "已自动接单，出租占用 30 分钟，正在履约";
    case "arrived":
      return "已到位，待客户确认使用";
    case "used":
      return "本单已灌注完成";
    case "rejected":
      return "已拒单";
    case "cancelled":
      return "客户已取消";
  }
}
