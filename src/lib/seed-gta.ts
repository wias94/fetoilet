import type { Sql } from "@/lib/db";

/** Full GTA import is a one-shot script (`scripts/seed-gta.mjs`). Do not bundle the 10k JSON into the app. */
export async function ensureGtaPeople(sql: Sql) {
  await sql`select 1`;
}
