import pg from 'pg';
import { readdir } from 'node:fs/promises';
const c = new pg.Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000});
try {
  await c.connect();
  const applied = new Set((await c.query('SELECT name FROM _migrations')).rows.map(r => r.name));
  const pending = (await readdir(new URL('../migrations/', import.meta.url)))
    .filter(f => f.endsWith('.sql') && !applied.has(f));
  if (pending.length) throw new Error('Pending migrations');
  const result = await c.query('SELECT count(*)::int AS n FROM history_daily');
  if (!result.rows[0].n) throw new Error('History archive missing');
  console.log('Database and migrations ready');
} catch {
  console.error('Database readiness check failed');
  process.exitCode = 1;
} finally {
  await c.end();
}
