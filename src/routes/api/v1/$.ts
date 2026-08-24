import { createFileRoute } from "@tanstack/react-router";
import {
  API_CONTRACT,
  apiError,
  apiPath,
  json,
  readJson,
  requireApiAdmin,
  requireApiUser,
} from "@/lib/api-http";
import {
  forceStallOffline,
  getUserState,
  isBanned,
  listAdminUsers,
  listEvents,
  listLocations,
  listNearby,
  recordEvent,
  setBanned,
  touchSeen,
  upsertLocation,
  EVENT_KINDS,
} from "@/lib/behavior";
import { NEARBY_RADIUS_M, parseLocation } from "@/lib/geo";

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: (ctx) => handle("GET", ctx.request),
      POST: (ctx) => handle("POST", ctx.request),
      PUT: (ctx) => handle("PUT", ctx.request),
      PATCH: (ctx) => handle("PATCH", ctx.request),
    },
  },
});

async function handle(method: string, request: Request) {
  try {
    const path = apiPath(request);
    const url = new URL(request.url);

    if (method === "GET" && (path === "" || path === "help")) {
      return json(API_CONTRACT);
    }
    if (method === "GET" && path === "health") {
      const { getDbSource, getDatabaseUrl } = await import("@/lib/db");
      const { runtimeEnv } = await import("@/lib/runtime-env");
      const { env } = await import("node:process");
      const keys = Object.keys(env)
        .filter((k) => /DATABASE|POSTGRES|NEON|^PG|RAILWAY|BETTER|R2_|ADMIN_API/i.test(k))
        .sort();
      return json({
        ok: true,
        db: getDatabaseUrl() ? getDbSource() : "none",
        database_url: Boolean(getDatabaseUrl()),
        railway: Boolean(runtimeEnv("RAILWAY_ENVIRONMENT")),
        env_keys: keys,
      });
    }

    if (path.startsWith("admin/")) {
      await requireApiAdmin();
      return await adminHandle(method, path, request, url);
    }

    const user = await requireApiUser();
    const banned = await isBanned(user.id);
    if (banned && !(method === "GET" && path === "me")) {
      const state = await getUserState(user.id);
      return apiError(state?.banReason ? `Banned: ${state.banReason}` : "Banned", 403);
    }
    await touchSeen(user.id);

    if (method === "GET" && path === "me") {
      const state = await getUserState(user.id);
      return json({
        ok: true,
        user: { id: user.id, email: user.email },
        banned: Boolean(state?.banned),
        ban_reason: state?.banReason ?? "",
        last_seen_at: state?.lastSeenAt ?? null,
        location: state?.location ?? null,
      });
    }

    if (path === "location") {
      if (method === "GET") {
        const state = await getUserState(user.id);
        return json({ ok: true, location: state?.location ?? null });
      }
      if (method === "PUT") {
        const body = await readJson(request);
        const result = await upsertLocation(user.id, body);
        return json({
          ok: true,
          updated: result.updated,
          retry_after_s: result.retry_after_s,
          location: result.state?.location ?? null,
        });
      }
    }

    if (method === "GET" && path === "nearby") {
      const state = await getUserState(user.id);
      const lat = url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : state?.location?.lat;
      const lng = url.searchParams.get("lng") ? Number(url.searchParams.get("lng")) : state?.location?.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return apiError("先 PUT /api/v1/location，或在 query 里带 lat lng", 400);
      }
      const stalls = await listNearby(lat, lng, NEARBY_RADIUS_M);
      return json({ ok: true, origin: { lat, lng }, radius_m: NEARBY_RADIUS_M, stalls });
    }

    if (path === "events") {
      if (method === "GET") {
        const kind = url.searchParams.get("kind") ?? undefined;
        const list = await listEvents({ userId: user.id, kind, limit: 50 });
        return json({ ok: true, events: list });
      }
      if (method === "POST") {
        const body = (await readJson(request)) as Record<string, unknown>;
        const kind = String(body.kind ?? "");
        if (!EVENT_KINDS.includes(kind as (typeof EVENT_KINDS)[number])) {
          return apiError("kind 不在允许列表", 400);
        }
        const lat = body.lat == null ? null : Number(body.lat);
        const lng = body.lng == null ? null : Number(body.lng);
        await recordEvent({
          userId: user.id,
          kind,
          targetId: typeof body.target_id === "string" ? body.target_id : null,
          payload: body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {},
          lat: Number.isFinite(lat as number) ? (lat as number) : null,
          lng: Number.isFinite(lng as number) ? (lng as number) : null,
        });
        return json({ ok: true });
      }
    }

    return apiError("not found", 404);
  } catch (err) {
    const status = (err as { status?: number }).status;
    const message = err instanceof Error ? err.message : "error";
    return apiError(message, status ?? 400);
  }
}

async function adminHandle(method: string, path: string, request: Request, url: URL) {
  if (method === "GET" && path === "admin/users") {
    return json({ ok: true, users: await listAdminUsers() });
  }

  if (method === "GET" && path === "admin/events") {
    const list = await listEvents({
      userId: url.searchParams.get("user_id") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
    });
    return json({ ok: true, events: list });
  }

  if (method === "GET" && path === "admin/locations") {
    return json({ ok: true, locations: await listLocations() });
  }

  const userMatch = path.match(/^admin\/users\/([^/]+)$/);
  if (userMatch) {
    const id = decodeURIComponent(userMatch[1]);
    if (method === "GET") {
      const state = await getUserState(id);
      return json({ ok: true, user_id: id, ...state });
    }
    if (method === "PATCH") {
      const body = (await readJson(request)) as Record<string, unknown>;
      if (typeof body.banned === "boolean") {
        await setBanned(id, body.banned, typeof body.ban_reason === "string" ? body.ban_reason : "");
      }
      if (body.location && typeof body.location === "object") {
        parseLocation(body.location);
        await upsertLocation(id, body.location, { force: true });
      }
      if (body.stall_online === false) {
        await forceStallOffline(id);
      }
      const state = await getUserState(id);
      return json({ ok: true, user_id: id, ...state });
    }
  }

  return apiError("not found", 404);
}
