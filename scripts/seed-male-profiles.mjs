import { readFileSync } from "node:fs";
import pg from "pg";
import { deriveMale } from "./male-derive.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const axesAll = JSON.parse(readFileSync("/tmp/male-axes.json", "utf8"));
const sql = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await sql.connect();
await sql.query(`set search_path to public`);
await sql.query(readFileSync(new URL("../migrations/0020_male_profiles.sql", import.meta.url), "utf8"));

const ownedRows = await sql.query(`
  select owner_id, relation, count(*)::int n
  from stalls
  where owner_id like 'loc-m-%' and relation is not null
  group by 1, 2
`);
const ownedBy = new Map();
for (const row of ownedRows.rows) {
  const cur = ownedBy.get(row.owner_id) ?? {};
  cur[row.relation] = Number(row.n);
  ownedBy.set(row.owner_id, cur);
}

const men = await sql.query(`
  select u.id, s.person_id
  from public."user" u
  join user_state s on s.user_id = u.id
  where u.id like 'loc-m-%'
`);

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const records = [];
for (const u of men.rows) {
  const src = axesAll[u.person_id];
  if (!src) continue;
  const derived = deriveMale(src, ownedBy.get(u.id) || {});
  records.push({
    user_id: u.id,
    person_id: u.person_id,
    age: src.age || null,
    job: src.job,
    family_status: src.family_status,
    sociability: src.sociability,
    routine_preference: src.routine_preference,
    spontaneity: src.spontaneity,
    travel_tolerance: src.travel_tolerance,
    nightlife_preference: src.nightlife_preference,
    activity_budget: src.activity_budget,
    family_orientation: src.family_orientation,
    warmth: src.warmth,
    directness: src.directness,
    patience: src.patience,
    communication_style: src.communication_style,
    personality_summary: src.personality_summary,
    taste: JSON.stringify(derived.taste),
    session_style: derived.session_style,
    condom_pref: derived.condom_pref,
    objectify: derived.objectify,
    novelty: derived.novelty,
    risk: derived.risk,
    budget_band: derived.budget_band,
  });
}

for (const part of chunk(records, 200)) {
  const values = [];
  const params = [];
  let i = 1;
  for (const r of part) {
    const row = [
      r.user_id, r.person_id, r.age, r.job, r.family_status,
      r.sociability, r.routine_preference, r.spontaneity, r.travel_tolerance, r.nightlife_preference,
      r.activity_budget, r.family_orientation, r.warmth, r.directness, r.patience,
      r.communication_style, r.personality_summary, r.taste, r.session_style, r.condom_pref,
      r.objectify, r.novelty, r.risk, r.budget_band,
    ];
    const slots = row.map(() => `$${i++}`);
    values.push(
      `(${slots[0]},${slots[1]},${slots[2]},${slots[3]},${slots[4]},${slots[5]},${slots[6]},${slots[7]},${slots[8]},${slots[9]},${slots[10]},${slots[11]},${slots[12]},${slots[13]},${slots[14]},${slots[15]},${slots[16]},${slots[17]}::jsonb,${slots[18]},${slots[19]},${slots[20]},${slots[21]},${slots[22]},${slots[23]},true,now(),now())`,
    );
    params.push(...row);
  }
  await sql.query(
    `insert into male_profiles (
      user_id, person_id, age, job, family_status,
      sociability, routine_preference, spontaneity, travel_tolerance, nightlife_preference,
      activity_budget, family_orientation, warmth, directness, patience,
      communication_style, personality_summary, taste, session_style, condom_pref,
      objectify, novelty, risk, budget_band, sim_enabled, created_at, updated_at
    ) values ${values.join(",")}
    on conflict (user_id) do update set
      person_id = excluded.person_id,
      age = excluded.age,
      job = excluded.job,
      family_status = excluded.family_status,
      sociability = excluded.sociability,
      routine_preference = excluded.routine_preference,
      spontaneity = excluded.spontaneity,
      travel_tolerance = excluded.travel_tolerance,
      nightlife_preference = excluded.nightlife_preference,
      activity_budget = excluded.activity_budget,
      family_orientation = excluded.family_orientation,
      warmth = excluded.warmth,
      directness = excluded.directness,
      patience = excluded.patience,
      communication_style = excluded.communication_style,
      personality_summary = excluded.personality_summary,
      taste = excluded.taste,
      session_style = excluded.session_style,
      condom_pref = excluded.condom_pref,
      objectify = excluded.objectify,
      novelty = excluded.novelty,
      risk = excluded.risk,
      budget_band = excluded.budget_band,
      sim_enabled = true,
      updated_at = now()`,
    params,
  );
}

const c = await sql.query(`
  select count(*)::int n,
         count(*) filter (where session_style='快餐灌注')::int fast,
         count(*) filter (where session_style='过夜')::int overnight,
         count(*) filter (where session_style='包厕')::int pack,
         count(*) filter (where condom_pref='无套优先')::int bare,
         count(*) filter (where condom_pref='必须套')::int condom,
         count(*) filter (where budget_band='高')::int rich
  from male_profiles
`);
console.log(c.rows[0], "upserted", records.length);
await sql.query(`insert into _migrations (name) values ('0020_male_profiles.sql') on conflict do nothing`);
await sql.end();
