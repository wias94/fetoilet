import { getSql, type Sql } from "@/lib/db";
import type { LocSource, LocationFix } from "@/lib/geo";
import { LOCATION_INTERVAL_MS, distanceM, parseLocation } from "@/lib/geo";

export const EVENT_KINDS = [
  "page_view",
  "session",
  "location",
  "inquiry_place",
  "inquiry_accept",
  "inquiry_arrive",
  "inquiry_use",
  "inquiry_cancel",
  "stall_online",
  "stall_offline",
  "review",
  "claim",
  "buy",
  "admin_ban",
  "admin_unban",
  "admin_force_offline",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export type UserState = {
  userId: string;
  banned: boolean;
  banReason: string;
  lastSeenAt: string | null;
  location: LocationFix | null;
};

function toLocation(row: {
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  heading: number | null;
  speed_mps: number | null;
  loc_source: string | null;
  loc_updated_at: string | null;
}): LocationFix | null {
  if (row.lat == null || row.lng == null) return null;
  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),
    heading: row.heading == null ? null : Number(row.heading),
    speed_mps: row.speed_mps == null ? null : Number(row.speed_mps),
    source: (row.loc_source as LocSource) || "fake",
    updated_at: row.loc_updated_at,
  };
}

export async function ensureUserState(sql: Sql, userId: string) {
  await sql`
    insert into user_state (user_id) values (${userId})
    on conflict (user_id) do nothing
  `;
}

export async function getUserState(userId: string): Promise<UserState | null> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    banned: boolean;
    ban_reason: string;
    last_seen_at: string | null;
    lat: number | null;
    lng: number | null;
    accuracy_m: number | null;
    heading: number | null;
    speed_mps: number | null;
    loc_source: string | null;
    loc_updated_at: string | null;
  }>`
    select user_id, banned, ban_reason, last_seen_at, lat, lng, accuracy_m, heading, speed_mps, loc_source, loc_updated_at
    from user_state where user_id = ${userId} limit 1
  `;
  if (!rows[0]) {
    return {
      userId,
      banned: false,
      banReason: "",
      lastSeenAt: null,
      location: null,
    };
  }
  const r = rows[0];
  return {
    userId: r.user_id,
    banned: Boolean(r.banned),
    banReason: r.ban_reason ?? "",
    lastSeenAt: r.last_seen_at,
    location: toLocation(r),
  };
}

export async function isBanned(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ banned: boolean }>`
    select banned from user_state where user_id = ${userId} limit 1
  `;
  return Boolean(rows[0]?.banned);
}

export async function touchSeen(userId: string) {
  const sql = await getSql();
  await ensureUserState(sql, userId);
  await sql`update user_state set last_seen_at = now(), updated_at = now() where user_id = ${userId}`;
}

export async function setBanned(userId: string, banned: boolean, reason: string) {
  const sql = await getSql();
  await ensureUserState(sql, userId);
  await sql`
    update user_state
    set banned = ${banned}, ban_reason = ${reason}, updated_at = now()
    where user_id = ${userId}
  `;
  await recordEvent({
    userId,
    kind: banned ? "admin_ban" : "admin_unban",
    targetId: userId,
    payload: { reason },
  });
}

export async function upsertLocation(
  userId: string,
  raw: unknown,
  opts: { copyToStall?: boolean; force?: boolean } = {},
) {
  const copyToStall = opts.copyToStall !== false;
  const fix = parseLocation(raw);
  const sql = await getSql();
  await ensureUserState(sql, userId);

  const live = opts.force || fix.source === "fake" || fix.source === "manual";
  if (!live) {
    const prev = await sql<{ loc_updated_at: string | null }>`
      select loc_updated_at from user_state where user_id = ${userId} limit 1
    `;
    const last = prev[0]?.loc_updated_at ? Date.parse(prev[0].loc_updated_at) : 0;
    if (last && Date.now() - last < LOCATION_INTERVAL_MS) {
      const state = await getUserState(userId);
      const wait = LOCATION_INTERVAL_MS - (Date.now() - last);
      return { state, updated: false, retry_after_s: Math.ceil(wait / 1000) };
    }
  }

  await sql`
    update user_state set
      lat = ${fix.lat},
      lng = ${fix.lng},
      accuracy_m = ${fix.accuracy_m},
      heading = ${fix.heading},
      speed_mps = ${fix.speed_mps},
      loc_source = ${fix.source},
      loc_updated_at = now(),
      last_seen_at = now(),
      updated_at = now()
    where user_id = ${userId}
  `;
  if (copyToStall) {
    await sql`
      update stalls set lat = ${fix.lat}, lng = ${fix.lng}, updated_at = now()
      where user_id = ${userId}
    `;
  }
  await recordEvent({
    userId,
    kind: "location",
    payload: { source: fix.source },
    lat: fix.lat,
    lng: fix.lng,
  });
  return { state: await getUserState(userId), updated: true, retry_after_s: 180 };
}

export async function recordEvent(input: {
  userId: string;
  kind: EventKind | string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  lat?: number | null;
  lng?: number | null;
}) {
  try {
    const sql = await getSql();
    await sql`
      insert into events (id, user_id, kind, target_id, payload, lat, lng)
      values (
        ${crypto.randomUUID()},
        ${input.userId},
        ${input.kind},
        ${input.targetId ?? null},
        ${JSON.stringify(input.payload ?? {})}::jsonb,
        ${input.lat ?? null},
        ${input.lng ?? null}
      )
    `;
  } catch (err) {
    console.error("[events]", err);
  }
}

export async function listEvents(opts: {
  userId?: string;
  kind?: string;
  limit?: number;
}) {
  const sql = await getSql();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = await sql<{
    id: string;
    user_id: string;
    kind: string;
    target_id: string | null;
    payload: unknown;
    lat: number | null;
    lng: number | null;
    created_at: string;
  }>`
    select id, user_id, kind, target_id, payload, lat, lng, created_at
    from events
    where (${opts.userId ?? null}::text is null or user_id = ${opts.userId ?? null})
      and (${opts.kind ?? null}::text is null or kind = ${opts.kind ?? null})
    order by created_at desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    kind: r.kind,
    target_id: r.target_id,
    payload: r.payload,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    created_at: r.created_at,
  }));
}

export async function listLocations() {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    banned: boolean;
    lat: number | null;
    lng: number | null;
    loc_source: string | null;
    loc_updated_at: string | null;
    last_seen_at: string | null;
  }>`
    select user_id, banned, lat, lng, loc_source, loc_updated_at, last_seen_at
    from user_state
    where lat is not null
    order by loc_updated_at desc nulls last
    limit 200
  `;
  return rows.map((r) => ({
    user_id: r.user_id,
    banned: Boolean(r.banned),
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    source: r.loc_source,
    updated_at: r.loc_updated_at,
    last_seen_at: r.last_seen_at,
  }));
}

export async function listNearby(lat: number, lng: number, radiusM: number) {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    area: string;
    online: boolean;
    hour_fen: number;
    eta_min: number;
    image: string;
    lat: number;
    lng: number;
  }>`
    select id, name, area, online, hour_fen, eta_min, image, lat, lng
    from stalls
    where lat is not null and lng is not null
      and coalesce(hidden, false) = false
  `;
  return rows
    .map((r) => {
      const distance_m = distanceM(lat, lng, Number(r.lat), Number(r.lng));
      return {
        id: r.id,
        name: r.name,
        area: r.area,
        online: Boolean(r.online),
        hour_fen: Number(r.hour_fen),
        eta_min: Number(r.eta_min),
        image: r.image,
        lat: Number(r.lat),
        lng: Number(r.lng),
        distance_m,
      };
    })
    .filter((r) => r.distance_m <= radiusM)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 40);
}

export async function listAdminUsers() {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string | null;
    email: string | null;
    created_at: string;
    banned: boolean | null;
    ban_reason: string | null;
    lat: number | null;
    lng: number | null;
    last_seen_at: string | null;
    stall_id: string | null;
    stall_name: string | null;
  }>`
    select u.id, u.name, u.email, u.created_at,
      s.banned, s.ban_reason, s.lat, s.lng, s.last_seen_at,
      st.id as stall_id, st.name as stall_name
    from "user" u
    left join user_state s on s.user_id = u.id
    left join stalls st on st.user_id = u.id
    order by u.created_at desc
    limit 200
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    created_at: r.created_at,
    banned: Boolean(r.banned),
    ban_reason: r.ban_reason ?? "",
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    last_seen_at: r.last_seen_at,
    stall_id: r.stall_id,
    stall_name: r.stall_name,
  }));
}

export async function forceStallOffline(userId: string) {
  const sql = await getSql();
  await sql`update stalls set online = false, updated_at = now() where user_id = ${userId}`;
  await recordEvent({ userId, kind: "admin_force_offline", targetId: userId });
}
