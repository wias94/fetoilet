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
const axesAll = JSON.parse(readFileSync("/tmp/person-axes.json", "utf8"));
const sql = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await sql.connect();
await sql.query(`set search_path to public`);

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const people = Object.entries(axesAll).map(([person_id, src]) => ({ person_id, ...src }));
for (const part of chunk(people, 400)) {
  const params = [];
  const values = [];
  let i = 1;
  for (const r of part) {
    const row = [
      r.person_id, r.sociability, r.routine_preference, r.spontaneity, r.travel_tolerance,
      r.nightlife_preference, r.activity_budget, r.family_orientation, r.warmth, r.directness,
      r.patience, r.communication_style, r.personality_summary,
    ];
    const slots = row.map(() => `$${i++}`);
    values.push(`(${slots.join(",")})`);
    params.push(...row);
  }
  await sql.query(
    `insert into behavior_person (
      person_id, sociability, routine_preference, spontaneity, travel_tolerance,
      nightlife_preference, activity_budget, family_orientation, warmth, directness, patience,
      communication_style, personality_summary
    ) values ${values.join(",")}
    on conflict (person_id) do update set
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
      updated_at = now()`,
    params,
  );
}

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

const records = [];
for (const u of men.rows) {
  const src = axesAll[u.person_id];
  if (!src) continue;
  const derived = deriveMale(src, ownedBy.get(u.id) || {}, { familyStatus: src.family_status, age: src.age });
  records.push({
    user_id: u.id,
    person_id: u.person_id,
    age: src.age || null,
    job: src.job,
    family_status: src.family_status,
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
  const params = [];
  const values = [];
  let i = 1;
  for (const r of part) {
    const row = [
      r.user_id, r.person_id, r.job, r.family_status, r.taste, r.session_style, r.condom_pref,
      r.objectify, r.novelty, r.risk, r.budget_band,
    ];
    const slots = row.map(() => `$${i++}`);
    values.push(`(${slots[0]},${slots[1]},${slots[2]},${slots[3]},${slots[4]}::jsonb,${slots[5]},${slots[6]},${slots[7]},${slots[8]},${slots[9]},${slots[10]},true,now())`);
    params.push(...row);
  }
  await sql.query(
    `insert into behavior_male (
      user_id, person_id, job, family_status, taste, session_style, condom_pref,
      objectify, novelty, risk, budget_band, sim_enabled, updated_at
    ) values ${values.join(",")}
    on conflict (user_id) do update set
      person_id = excluded.person_id,
      job = excluded.job,
      family_status = excluded.family_status,
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
  const ages = part.map((r) => r.age);
  const ids = part.map((r) => r.user_id);
  await sql.query(
    `update user_state u set age = a.age, updated_at = now()
     from unnest($1::text[], $2::int[]) as a(user_id, age)
     where u.user_id = a.user_id`,
    [ids, ages],
  );
}

await sql.query(`
  insert into behavior_stall (stall_id, person_id, sim_enabled)
  select id, person_id, true from stalls where person_id is not null
  on conflict (stall_id) do update set person_id = excluded.person_id, sim_enabled = true
`);

const c = await sql.query(`
  select
    (select count(*)::int from behavior_person) person,
    (select count(*)::int from behavior_male) male,
    (select count(*)::int from behavior_stall) stall,
    (select count(age)::int from user_state) aged
`);
console.log(c.rows[0], "males upserted", records.length);
await sql.end();
