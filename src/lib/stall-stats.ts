import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { holdingCut, splitFen } from "@/lib/yield";

export type DayStat = {
  date: string;
  used: number;
  fen: number;
};

export type StallStats = {
  stallName: string;
  hourFen: number;
  online: boolean;
  ratingAvg: number;
  ratingCount: number;
  todayCalled: number;
  todayPending: number;
  todayActive: number;
  todayUsed: number;
  todayRejected: number;
  todayFen: number;
  weekUsed: number;
  weekFen: number;
  allUsed: number;
  allFen: number;
  acceptRate: number | null;
  hasOwner: boolean;
  holdWeeks: number;
  ownerSharePct: number;
  platformSharePct: number;
  days: DayStat[];
};

const EMPTY_DAYS: DayStat[] = [];

function emptyStats(): StallStats {
  return {
    stallName: "",
    hourFen: 0,
    online: false,
    ratingAvg: 0,
    ratingCount: 0,
    todayCalled: 0,
    todayPending: 0,
    todayActive: 0,
    todayUsed: 0,
    todayRejected: 0,
    todayFen: 0,
    weekUsed: 0,
    weekFen: 0,
    allUsed: 0,
    allFen: 0,
    acceptRate: null,
    hasOwner: false,
    holdWeeks: 0,
    ownerSharePct: 100,
    platformSharePct: 0,
    days: EMPTY_DAYS,
  };
}

export const getMyStallStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StallStats | null> => {
    const sql = await getSql();
    const stall = await sql<{
      id: string;
      name: string;
      hour_fen: number;
      online: boolean;
      owner_id: string | null;
      relation: string | null;
      owned_at: string | null;
    }>`
      select id, name, hour_fen, online, owner_id, relation, owned_at
      from stalls
      where user_id = ${context.userId}
      limit 1
    `;
    if (!stall[0]) return null;

    const id = stall[0].id;
    const hourFen = Number(stall[0].hour_fen);
    const hasOwner = Boolean(stall[0].owner_id && !String(stall[0].owner_id).startsWith("seed:"));
    const cut = holdingCut(stall[0].relation, stall[0].owned_at);
    const ownerUnit = splitFen(hourFen, cut).ownerFen;
    const stats = emptyStats();
    stats.stallName = stall[0].name;
    stats.hourFen = hourFen;
    stats.online = Boolean(stall[0].online);
    stats.hasOwner = hasOwner;
    stats.holdWeeks = cut.weeks;
    stats.ownerSharePct = hasOwner ? cut.ownerSharePct : 0;
    stats.platformSharePct = hasOwner ? cut.platformSharePct : 0;

    const today = await sql<{
      called: number;
      pending: number;
      active: number;
      used: number;
      rejected: number;
    }>`
      select
        count(*) filter (
          where (created_at at time zone 'Asia/Shanghai')::date
            = (now() at time zone 'Asia/Shanghai')::date
        )::int as called,
        count(*) filter (where coalesce(status, 'pending') = 'pending')::int as pending,
        count(*) filter (where coalesce(status, 'pending') in ('accepted', 'arrived'))::int as active,
        count(*) filter (
          where coalesce(status, 'pending') = 'used'
            and (coalesce(updated_at, created_at) at time zone 'Asia/Shanghai')::date
              = (now() at time zone 'Asia/Shanghai')::date
        )::int as used,
        count(*) filter (
          where coalesce(status, 'pending') = 'rejected'
            and (coalesce(updated_at, created_at) at time zone 'Asia/Shanghai')::date
              = (now() at time zone 'Asia/Shanghai')::date
        )::int as rejected
      from inquiries
      where profile_id = ${id}
    `;
    stats.todayCalled = Number(today[0]?.called ?? 0);
    stats.todayPending = Number(today[0]?.pending ?? 0);
    stats.todayActive = Number(today[0]?.active ?? 0);
    stats.todayUsed = Number(today[0]?.used ?? 0);
    stats.todayRejected = Number(today[0]?.rejected ?? 0);
    stats.todayFen = 0;

    const totals = await sql<{
      used: number;
      week_used: number;
      accepted: number;
      rejected: number;
    }>`
      select
        count(*) filter (where coalesce(status, 'pending') = 'used')::int as used,
        count(*) filter (
          where coalesce(status, 'pending') = 'used'
            and coalesce(updated_at, created_at) >= now() - interval '7 days'
        )::int as week_used,
        count(*) filter (
          where coalesce(status, 'pending') in ('accepted', 'arrived', 'used')
        )::int as accepted,
        count(*) filter (where coalesce(status, 'pending') = 'rejected')::int as rejected
      from inquiries
      where profile_id = ${id}
    `;
    stats.allUsed = Number(totals[0]?.used ?? 0);
    stats.weekUsed = Number(totals[0]?.week_used ?? 0);
    stats.allFen = 0;
    stats.weekFen = 0;
    const accepted = Number(totals[0]?.accepted ?? 0);
    const rejected = Number(totals[0]?.rejected ?? 0);
    const decided = accepted + rejected;
    stats.acceptRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

    const rating = await sql<{ avg: number; n: number }>`
      select coalesce(avg(score), 0)::float as avg, count(*)::int as n
      from reviews
      where profile_id = ${id}
    `;
    stats.ratingAvg = Number(rating[0]?.avg ?? 0);
    stats.ratingCount = Number(rating[0]?.n ?? 0);

    const ownerId = stall[0].owner_id;
    const dayRows = await sql<{ d: string; n: number; paid: number }>`
      select
        (coalesce(updated_at, created_at) at time zone 'Asia/Shanghai')::date::text as d,
        count(*)::int as n,
        count(*) filter (where user_id is distinct from ${ownerId})::int as paid
      from inquiries
      where profile_id = ${id}
        and coalesce(status, 'pending') = 'used'
        and coalesce(updated_at, created_at) >= now() - interval '6 days'
      group by 1
      order by 1
    `;
    const byDate = new Map(dayRows.map((r) => [r.d, { n: Number(r.n), paid: Number(r.paid) }]));
    const days: DayStat[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const stamp = new Date(now.getTime() - i * 86400000);
      const shanghai = new Date(stamp.getTime() + 8 * 3600000);
      const key = shanghai.toISOString().slice(0, 10);
      const row = byDate.get(key);
      const used = row?.n ?? 0;
      const paid = row?.paid ?? 0;
      days.push({ date: key, used, fen: paid * ownerUnit });
    }
    stats.days = days;
    return stats;
  });
