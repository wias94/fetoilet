import { runtimeEnv } from "@/lib/runtime-env";
import { getSql } from "@/lib/db";
import { LOCATION_INTERVAL_MS } from "@/lib/geo";

type PersonFix = { id: string; lat: number; lng: number };

const cache: { at: number; running: Promise<number> | null } = { at: 0, running: null };

export function locationApiBase() {
  return runtimeEnv("LOCATION_API_URL")?.replace(/\/$/, "") ?? "";
}

function locationApiKey() {
  return runtimeEnv("LOCATION_API_KEY") ?? runtimeEnv("PUBLIC_API_KEY") ?? "";
}

function simHeaders(): Record<string, string> {
  const key = locationApiKey();
  return key ? { "X-API-Key": key } : {};
}

export async function fetchPersonLocation(personId: string): Promise<PersonFix | null> {
  const base = locationApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/v1/people/${encodeURIComponent(personId)}/location`, {
      headers: simHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: unknown; lng?: unknown };
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { id: personId, lat, lng };
  } catch {
    return null;
  }
}

export async function refreshUserFromSim(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ location_id: string | null; loc_updated_at: string | null }>`
    select location_id, loc_updated_at from user_state where user_id = ${userId} limit 1
  `;
  const personId = rows[0]?.location_id || (/^P\d{5}$/.test(userId) ? userId : null);
  if (!personId) return;
  const last = rows[0]?.loc_updated_at ? Date.parse(rows[0].loc_updated_at) : 0;
  if (last && Date.now() - last < LOCATION_INTERVAL_MS) return;
  const fix = await fetchPersonLocation(personId);
  if (!fix) return;
  await writeFixes([fix], "gps");
}

export async function syncWorldIfDue() {
  const base = locationApiBase();
  if (!base) return 0;
  if (Date.now() - cache.at < LOCATION_INTERVAL_MS) return 0;
  if (cache.running) return cache.running;
  cache.running = (async () => {
    try {
      const res = await fetch(`${base}/api/v1/world?compact=true`, { headers: simHeaders() });
      if (!res.ok) return 0;
      const data = (await res.json()) as { p?: unknown };
      const rows = Array.isArray(data.p) ? data.p : [];
      const fixes: PersonFix[] = [];
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 3) continue;
        const id = String(row[0] ?? "");
        const lat = Number(row[1]);
        const lng = Number(row[2]);
        if (!/^P\d{5}$/.test(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        fixes.push({ id, lat, lng });
      }
      const n = await writeFixes(fixes, "gps");
      cache.at = Date.now();
      return n;
    } catch {
      return 0;
    } finally {
      cache.running = null;
    }
  })();
  return cache.running;
}

async function writeFixes(fixes: PersonFix[], source: "gps" | "fake") {
  if (!fixes.length) return 0;
  const sql = await getSql();
  const chunk = 400;
  for (let i = 0; i < fixes.length; i += chunk) {
    const part = fixes.slice(i, i + chunk);
    const ids = part.map((p) => p.id);
    const lats = part.map((p) => p.lat);
    const lngs = part.map((p) => p.lng);
    await sql.query(
      `update user_state u set
         lat = v.lat, lng = v.lng, loc_source = $4, loc_updated_at = now(), updated_at = now()
       from (select unnest($1::text[]) as id, unnest($2::float8[]) as lat, unnest($3::float8[]) as lng) v
       where u.user_id = v.id or u.location_id = v.id`,
      [ids, lats, lngs, source],
    );
    await sql.query(
      `update stalls s set lat = v.lat, lng = v.lng, updated_at = now()
       from (select unnest($1::text[]) as id, unnest($2::float8[]) as lat, unnest($3::float8[]) as lng) v
       where s.id = v.id or s.location_id = v.id or s.user_id = v.id`,
      [ids, lats, lngs],
    );
  }
  return fixes.length;
}
