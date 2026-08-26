import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getUserState, listNearby, upsertLocation } from "@/lib/behavior";
import { NEARBY_RADIUS_M } from "@/lib/geo";

/** Markham centre — used when the client has no fix yet. */
const FALLBACK = { lat: 43.8561, lng: -79.337 };

export function formatDistance(m: number) {
  if (m < 1000) return `${m} 米`;
  return `${(m / 1000).toFixed(1)} 公里`;
}

export const fetchNearby = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { refreshUserFromSim } = await import("@/lib/location-sim");
    await refreshUserFromSim(context.userId);

    let lat = data.lat;
    let lng = data.lng;
    let source: "gps" | "saved" | "fallback" = "saved";

    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      source = "gps";
      await upsertLocation(context.userId, { lat, lng, source: "gps" }, { copyToStall: false });
    } else {
      const state = await getUserState(context.userId);
      if (state?.location?.lat != null && state.location.lng != null) {
        lat = state.location.lat;
        lng = state.location.lng;
        source = "saved";
      } else {
        lat = FALLBACK.lat;
        lng = FALLBACK.lng;
        source = "fallback";
      }
    }

    const stalls = await listNearby(lat, lng, NEARBY_RADIUS_M);
    return {
      origin: { lat, lng },
      radius_m: NEARBY_RADIUS_M,
      source,
      stalls,
    };
  });
