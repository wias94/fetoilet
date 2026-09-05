import pg from "pg";
import { setTimeout } from "node:timers/promises";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1,
  connectionTimeoutMillis: 5000, statement_timeout: 60000 });
pool.on("error", (error) => console.error("[history] pool error", error.code));
let stopping = false;
const abort = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  stopping = true; abort.abort();
});
if (!process.env.DATABASE_URL) {
  console.error("[history] DATABASE_URL missing; persistent archive worker disabled");
} else {
  while (!stopping) {
    try {
      const result = await pool.query("SELECT archive_business_day() AS written");
      if (result.rows[0].written) console.log("[history] daily snapshots:", result.rows[0].written);
    } catch (error) {
      // Includes migration/startup races: retry without printing credentials.
      console.error("[history] archive failed; retry in 60s", error.code || error.name);
    }
    try { await setTimeout(60000, undefined, { signal: abort.signal }); } catch {}
  }
}
await pool.end();
