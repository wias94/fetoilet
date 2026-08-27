import { readFileSync } from "node:fs";
import pg from "pg";

const meanCad = Math.max(1, Number(process.argv[2] ?? 100));
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1_000_003) / 1_000_003;
}
function gauss(a, b) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.cos(2 * Math.PI * Math.max(1e-9, b));
}
function draw(userId, bias) {
  const z = gauss(hash01(userId), hash01(userId + ":w"));
  const sigma = 0.9;
  const mu = Math.log(meanCad) - (sigma * sigma) / 2;
  let cad = Math.exp(mu + sigma * z);
  cad *= 0.55 + (1 - (bias.cash_tight ?? 0.4)) * 0.5 + (bias.prestige ?? 0.4) * 0.35;
  cad *= bias.budget_band === "低" ? 0.55 : bias.budget_band === "高" ? 1.45 : 1;
  return Math.max(2, cad) * 100;
}

const sql = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await sql.connect();
const males = await sql.query(`
  select u.id,
    coalesce(e.cash_tight, 0.4) as cash_tight,
    coalesce(e.prestige, 0.4) as prestige,
    coalesce(m.budget_band, '中') as budget_band
  from "user" u
  join user_state s on s.user_id = u.id and s.role = 'male'
  left join behavior_econ e on e.user_id = u.id
  left join behavior_male m on m.user_id = u.id
  where u.id <> 'platform'
`);
const raw = males.rows.map((r) => ({
  id: r.id,
  fen: draw(r.id, r),
}));
const avg = raw.reduce((s, r) => s + r.fen, 0) / raw.length;
const k = (meanCad * 100) / avg;
const rows = raw.map((r) => ({ id: r.id, fen: Math.max(100, Math.round(r.fen * k)) }));

for (let i = 0; i < rows.length; i += 200) {
  const part = rows.slice(i, i + 200);
  const params = [];
  const values = [];
  let n = 1;
  for (const r of part) {
    values.push(`($${n++},$${n++})`);
    params.push(r.id, r.fen);
  }
  await sql.query(
    `insert into wallets (user_id, fen) values ${values.join(",")}
     on conflict (user_id) do update set fen = excluded.fen`,
    params,
  );
}

const stat = await sql.query(`
  select count(*)::int n,
    avg(fen)::int avg,
    percentile_cont(0.5) within group (order by fen)::int med,
    min(fen)::int min,
    max(fen)::int max,
    percentile_cont(0.9) within group (order by fen)::int p90
  from wallets w
  join user_state s on s.user_id = w.user_id and s.role = 'male'
`);
console.log({ meanCad, males: rows.length, ...stat.rows[0] });
await sql.end();
