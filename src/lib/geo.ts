export const NEARBY_RADIUS_M = 3000;
export const LOCATION_INTERVAL_MS = 3 * 60 * 1000;

export type LocSource = "gps" | "fake" | "manual" | "ip";

export type LocationFix = {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  heading: number | null;
  speed_mps: number | null;
  source: LocSource;
  updated_at: string | null;
};

export const SHANGHAI_FAKE: Record<string, { lat: number; lng: number; area: string }> = {
  xuhui: { lat: 31.1883, lng: 121.437, area: "徐汇" },
  jingan: { lat: 31.2235, lng: 121.4454, area: "静安" },
  huangpu: { lat: 31.2317, lng: 121.485, area: "黄浦" },
  changning: { lat: 31.2205, lng: 121.424, area: "长宁" },
  pudong: { lat: 31.2215, lng: 121.544, area: "浦东" },
};

const SOURCES = new Set<LocSource>(["gps", "fake", "manual", "ip"]);

export function parseLocation(input: unknown): {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  heading: number | null;
  speed_mps: number | null;
  source: LocSource;
} {
  if (!input || typeof input !== "object") throw new Error("location 要是对象");
  const raw = input as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("lat 范围 -90 ~ 90");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("lng 范围 -180 ~ 180");
  const sourceRaw = typeof raw.source === "string" ? raw.source : "fake";
  if (!SOURCES.has(sourceRaw as LocSource)) throw new Error("source 只能是 gps | fake | manual | ip");
  return {
    lat,
    lng,
    accuracy_m: numOrNull(raw.accuracy_m),
    heading: numOrNull(raw.heading),
    speed_mps: numOrNull(raw.speed_mps),
    source: sourceRaw as LocSource,
  };
}

function numOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}
