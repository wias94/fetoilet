import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getUserState, listNearby, upsertLocation } from "@/lib/behavior";
import { NEARBY_RADIUS_M } from "@/lib/geo";

import { getSql } from "@/lib/db";
import { listStallsNear } from "@/lib/stalls";

const Fix = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
});

async function resolveOrigin(userId: string, data: { lat?: number; lng?: number }) {
  const { refreshUserFromSim } = await import("@/lib/location-sim");
  await refreshUserFromSim(userId);

  let lat = data.lat;
  let lng = data.lng;
  let source: "gps" | "saved" | "none" = "saved";

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    source = "gps";
    await upsertLocation(userId, { lat, lng, source: "gps" }, { copyToStall: false });
  } else {
    const state = await getUserState(userId);
    if (state?.location?.lat != null && state.location.lng != null) {
      lat = state.location.lat;
      lng = state.location.lng;
      source = "saved";
    } else {
      return { origin: null as { lat: number; lng: number } | null, source: "none" as const };
    }
  }
  return { origin: { lat, lng }, source };
}

export const fetchNearby = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => Fix.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { origin, source } = await resolveOrigin(context.userId, data);
    if (!origin) {
      return { origin: null, radius_m: NEARBY_RADIUS_M, source, stalls: [] };
    }
    const stalls = await listNearby(origin.lat, origin.lng, NEARBY_RADIUS_M);
    return { origin, radius_m: NEARBY_RADIUS_M, source, stalls };
  });

export const listVisibleStalls = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => Fix.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { origin, source } = await resolveOrigin(context.userId, data);
    if (!origin) {
      return { origin: null, radius_m: NEARBY_RADIUS_M, source, stalls: [] };
    }
    const sql = await getSql();
    const stalls = await listStallsNear(sql, origin.lat, origin.lng, NEARBY_RADIUS_M, context.userId);
    return { origin, radius_m: NEARBY_RADIUS_M, source, stalls };
  });
