import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const seed = JSON.parse(readFileSync(new URL("../data/gta-seed.json", import.meta.url), "utf8"));
const sql = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await sql.connect();
await sql.query(`set search_path to public`);
await sql.query(`alter table stalls add column if not exists person_id text`);
await sql.query(`alter table stalls add column if not exists location_id text`);
await sql.query(`alter table user_state add column if not exists person_id text`);
await sql.query(`alter table user_state add column if not exists location_id text`);
await sql.query(`create unique index if not exists stalls_person_uidx on stalls (person_id) where person_id is not null`);

const hash = await hashPassword("P@ssw0rd");
const people = [];
for (const o of seed.owners) {
  people.push({
    id: `loc-m-${o.person_id.toLowerCase()}`,
    name: o.name,
    email: o.email,
    role: "male",
    personId: o.person_id,
    lat: null,
    lng: null,
  });
}
const ownerLat = new Map();
for (const s of seed.stalls) {
  people.push({
    id: `loc-s-${s.person_id.toLowerCase()}`,
    name: s.name,
    email: `${s.person_id.toLowerCase()}@stall.xiangce.app`,
    role: "stall",
    personId: s.person_id,
    lat: s.lat,
    lng: s.lng,
  });
  if (s.owner_person_id && s.lat != null) ownerLat.set(s.owner_person_id, [s.lat, s.lng]);
}
for (const p of people) {
  if (p.role === "male") {
    const home = ownerLat.get(p.personId);
    if (home) {
      p.lat = home[0];
      p.lng = home[1];
    }
  }
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

console.log("users", people.length, "stalls", seed.stalls.length);
for (const part of chunk(people, 400)) {
  const ids = part.map((p) => p.id);
  const names = part.map((p) => p.name);
  const emails = part.map((p) => p.email);
  await sql.query(
    `insert into public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     select u.id, u.name, u.email, true, now(), now()
     from unnest($1::text[], $2::text[], $3::text[]) as u(id, name, email)
     on conflict (id) do update set name = excluded.name, "updatedAt" = now()`,
    [ids, names, emails],
  );
}
console.log("users upserted");

for (const part of chunk(people, 400)) {
  const accIds = part.map(() => crypto.randomUUID().replaceAll("-", ""));
  const ids = part.map((p) => p.id);
  const hashes = part.map(() => hash);
  await sql.query(
    `insert into public.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     select a.id, a.uid, 'credential', a.uid, a.password, now(), now()
     from unnest($1::text[], $2::text[], $3::text[]) as a(id, uid, password)
     where not exists (
       select 1 from public.account x where x."userId" = a.uid and x."providerId" = 'credential'
     )`,
    [accIds, ids, hashes],
  );
  const roles = part.map((p) => p.role);
  const pids = part.map((p) => p.personId);
  const lats = part.map((p) => p.lat);
  const lngs = part.map((p) => p.lng);
  await sql.query(
    `insert into public.user_state (user_id, role, person_id, location_id, lat, lng, loc_source, loc_updated_at)
     select u.user_id, u.role, u.person_id, u.person_id, u.lat, u.lng, 'gps', now()
     from unnest($1::text[], $2::text[], $3::text[], $4::float8[], $5::float8[]) as u(user_id, role, person_id, lat, lng)
     on conflict (user_id) do update set
       role = excluded.role,
       person_id = excluded.person_id,
       location_id = excluded.location_id,
       lat = coalesce(excluded.lat, user_state.lat),
       lng = coalesce(excluded.lng, user_state.lng),
       updated_at = now()`,
    [ids, roles, pids, lats, lngs],
  );
}
console.log("accounts + user_state upserted");

const tags = JSON.stringify(["visit", "night"]);
const places = JSON.stringify(["你家", "酒店", "她家"]);
const extras = JSON.stringify([]);
for (const part of chunk(seed.stalls, 200)) {
  const rows = part.map((s) => {
    const sid = `loc-s-${s.person_id.toLowerCase()}`;
    const ownerId = s.owner_person_id ? `loc-m-${s.owner_person_id.toLowerCase()}` : null;
    const services = JSON.stringify(s.condom === "必须带套" ? ["口交", "性交"] : ["口交", "性交", "内射"]);
    return [
      s.person_id,
      sid,
      s.name,
      s.age,
      s.heightCm,
      s.cup,
      tags,
      s.image,
      s.hourFen,
      s.nightFen,
      s.etaMin,
      places,
      s.bio,
      services,
      `可上门 · 约 ${s.etaMin} 分钟抵达`,
      ownerId,
      s.relation,
      s.weightKg,
      s.identity,
      s.job,
      s.personality,
      s.marriage,
      s.demeanor,
      s.moan,
      s.skillLevel,
      s.orgasm,
      s.feel,
      s.persona,
      JSON.stringify(s.sellingPoints),
      s.hoursTag,
      s.dailyQuota,
      s.travel,
      s.condom,
      extras,
      s.reviewPref,
      s.person_id,
      s.lat,
      s.lng,
    ];
  });
  const cols = 38;
  const values = [];
  const params = [];
  let i = 1;
  for (const row of rows) {
    const slots = [];
    for (let c = 0; c < cols; c++) {
      slots.push(`$${i++}`);
      params.push(row[c]);
    }
    values.push(
      `(${slots[0]},${slots[1]},${slots[2]},${slots[3]},${slots[4]},${slots[5]},${slots[6]}::jsonb,${slots[7]},true,${slots[8]},${slots[9]},${slots[10]},${slots[11]}::jsonb,${slots[12]},${slots[13]}::jsonb,${slots[14]},${slots[15]},${slots[16]},${slots[17]},${slots[18]},${slots[19]},${slots[20]},${slots[21]},${slots[22]},${slots[23]},${slots[24]},${slots[25]},${slots[26]},${slots[27]},${slots[28]}::jsonb,${slots[29]},${slots[30]},${slots[31]},${slots[32]},${slots[33]}::jsonb,${slots[34]},5000,${slots[35]},${slots[35]},${slots[36]},${slots[37]})`,
    );
  }
  await sql.query(
    `insert into stalls (
      id, user_id, name, age, height_cm, cup, tags, image, online,
      hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
      relation, weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level,
      orgasm, feel, persona, selling_points, hours_tag, daily_quota, travel,
      condom, extras, review_pref, deposit_fen, person_id, location_id, lat, lng
    ) values ${values.join(",")}
    on conflict (id) do update set
      name = excluded.name,
      owner_id = excluded.owner_id,
      relation = excluded.relation,
      personality = excluded.personality,
      job = excluded.job,
      persona = excluded.persona,
      lat = excluded.lat,
      lng = excluded.lng,
      person_id = excluded.person_id,
      location_id = excluded.location_id,
      bio = excluded.bio,
      updated_at = now()`,
    params,
  );
}

const c = await sql.query(`select count(*)::int n, count(person_id)::int p, count(owner_id)::int o from stalls`);
const u = await sql.query(
  `select count(*)::int n,
          count(*) filter (where id like 'loc-m-%')::int m,
          count(*) filter (where id like 'loc-s-%')::int s
   from public."user"`,
);
const r = await sql.query(
  `select coalesce(relation,'(无主)') as relation, count(*)::int n from stalls group by 1 order by 2 desc`,
);
console.log("users", u.rows[0], "stalls", c.rows[0]);
console.log("relation", r.rows);
await sql.end();
