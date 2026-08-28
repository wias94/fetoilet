import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getUserState, listNearby, upsertLocation } from "@/lib/behavior";

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
    const { loadSimConfig } = await import("@/lib/sim-config");
    const cfg = await loadSimConfig();
    const radius = cfg.nearbyRadiusM;
    if (!origin) {
      return { origin: null, radius_m: radius, source, stalls: [] };
    }
    const stalls = await listNearby(origin.lat, origin.lng, radius);
    return { origin, radius_m: radius, source, stalls };
  });

export const listVisibleStalls = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => Fix.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { origin, source } = await resolveOrigin(context.userId, data);
    const sql = await getSql();
    const { loadSimConfig } = await import("@/lib/sim-config");
    const cfg = await loadSimConfig(sql);
    const radius = cfg.nearbyRadiusM;
    if (!origin) {
      return { origin: null, radius_m: radius, source, stalls: [] };
    }
    const { releaseExpiredRentals } = await import("@/lib/occupancy");
    await releaseExpiredRentals(sql);
    await import("@/lib/text-scale").then((m) => m.loadTextScale(sql));
    const stalls = await listStallsNear(sql, origin.lat, origin.lng, radius, context.userId);
    const { loadMaleDims, rankByDims } = await import("@/lib/dims");
    const { loadMaleEcon } = await import("@/lib/econ");
    const [male, econ] = await Promise.all([
      loadMaleDims(sql, context.userId),
      loadMaleEcon(sql, context.userId),
    ]);
    return { origin, radius_m: radius, source, stalls: rankByDims(male, stalls, econ) };
  });
