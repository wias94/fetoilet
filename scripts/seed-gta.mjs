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

await sql.query(`delete from messages`);
await sql.query(`delete from conversations`);
await sql.query(`delete from posts`);
await sql.query(`delete from reviews`);
await sql.query(`delete from inquiries`);
await sql.query(`delete from orders`);
await sql.query(`delete from claim_requests`);
await sql.query(`delete from ledger`);
await sql.query(`delete from wallets`);
await sql.query(`delete from events`);
await sql.query(`delete from stalls`);
await sql.query(`delete from session where "userId" <> 'admin'`);
await sql.query(`delete from account where "userId" <> 'admin'`);
await sql.query(`delete from user_state where user_id <> 'admin'`);
await sql.query(`delete from public."user" where id <> 'admin'`);

const hash = await hashPassword("P@ssw0rd");
const people = [];
for (const o of seed.owners) {
  people.push({
    id: `loc-m-${o.person_id.toLowerCase()}`,
    name: o.name,
    email: o.email,
    role: "male",
    personId: o.person_id,
  });
}
for (const s of seed.stalls) {
  people.push({
    id: `loc-s-${s.person_id.toLowerCase()}`,
    name: s.name,
    email: `${s.person_id.toLowerCase()}@stall.xiangce.app`,
    role: "stall",
    personId: s.person_id,
  });
}

await sql.query("begin");
try {
  for (const p of people) {
    await sql.query(
      `insert into public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       values ($1,$2,$3,true,now(),now())
       on conflict (id) do update set name = excluded.name, "updatedAt" = now()`,
      [p.id, p.name, p.email],
    );
  }
  const ids = people.map((p) => p.id);
  const found = await sql.query(`select id from public."user" where id = any($1::text[])`, [ids]);
  if (found.rows.length !== people.length) {
    const have = new Set(found.rows.map((r) => r.id));
    const missing = ids.filter((id) => !have.has(id));
    throw new Error(`user insert missing ${missing.slice(0, 8).join(",")} (${missing.length})`);
  }
  for (const p of people) {
    await sql.query(
      `insert into public.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1,$2,'credential',$2,$3,now(),now())
       on conflict (id) do nothing`,
      [crypto.randomUUID().replaceAll("-", ""), p.id, hash],
    );
    await sql.query(
      `insert into public.user_state (user_id, role, person_id, location_id)
       values ($1,$2,$3,$3)
       on conflict (user_id) do update set role = excluded.role, person_id = excluded.person_id, location_id = excluded.location_id, updated_at = now()`,
      [p.id, p.role, p.personId],
    );
  }
  await sql.query("commit");
} catch (err) {
  await sql.query("rollback");
  throw err;
}

let n = 0;
await sql.query("begin");
try {
  for (const s of seed.stalls) {
    const sid = `loc-s-${s.person_id.toLowerCase()}`;
    const ownerId = `loc-m-${s.owner_person_id.toLowerCase()}`;
    const tags = JSON.stringify(["visit", "night"]);
    const places = JSON.stringify(["你家", "酒店", "她家"]);
    const services = JSON.stringify(s.condom === "必须带套" ? ["口交", "性交"] : ["口交", "性交", "内射"]);
    await sql.query(
      `insert into stalls (
        id, user_id, name, age, height_cm, cup, tags, image, online,
        hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
        relation, weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level,
        orgasm, feel, persona, selling_points, hours_tag, daily_quota, travel,
        condom, extras, review_pref, deposit_fen, person_id, location_id, lat, lng
      ) values (
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8,true,
        $9,$10,$11,$12::jsonb,$13,$14::jsonb,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,
        $26,$27,$28,$29::jsonb,$30,$31,$32,
        $33,'[]'::jsonb,$34,5000,$35,$35,$36,$37
      ) on conflict (id) do nothing`,
      [
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
        s.reviewPref,
        s.person_id,
        s.lat,
        s.lng,
      ],
    );
    n += 1;
  }
  await sql.query("commit");
} catch (err) {
  await sql.query("rollback");
  throw err;
}

const c = await sql.query(`select count(*)::int n, count(person_id)::int p from stalls`);
const r = await sql.query(
  `select relation, count(*)::int n from stalls where person_id is not null group by 1 order by 2 desc`,
);
const persona = await sql.query(
  `select persona, count(*)::int n from stalls group by 1 order by 2 desc`,
);
const u = await sql.query(`select count(*)::int n from public."user"`);
console.log("users", u.rows[0], "stalls", c.rows[0], "inserted", n);
console.log("relation", r.rows);
console.log("persona", persona.rows);
await sql.end();
