import { hashPassword } from "better-auth/crypto";
import type { Sql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";
import seed from "../../data/gta-seed.json";

const PASSWORD = "P@ssw0rd";

type SeedStall = (typeof seed)["stalls"][number];
type SeedOwner = (typeof seed)["owners"][number];

async function ensureCredential(
  sql: Sql,
  id: string,
  name: string,
  email: string,
  role: "male" | "stall",
  hash: string,
  personId: string,
) {
  const existing = await sql<{ id: string }>`select id from "user" where id = ${id} limit 1`;
  if (!existing[0]) {
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${id}, ${name}, ${email}, true, now(), now())
    `;
  }
  const acc = await sql<{ id: string }>`
    select id from account where "userId" = ${id} and "providerId" = 'credential' limit 1
  `;
  if (!acc[0]) {
    await sql`
      insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${crypto.randomUUID().replaceAll("-", "")}, ${id}, 'credential', ${id}, ${hash}, now(), now())
    `;
  }
  await ensureUserState(sql, id);
  await sql`
    update user_state set role = ${role}, person_id = ${personId}, location_id = ${personId}, updated_at = now() where user_id = ${id}
  `;
}

export async function wipeFakeAccounts(sql: Sql) {
  await sql`delete from messages`;
  await sql`delete from conversations`;
  await sql`delete from posts`;
  await sql`delete from reviews`;
  await sql`delete from inquiries`;
  await sql`delete from orders`;
  await sql`delete from claim_requests`;
  await sql`delete from ledger`;
  await sql`delete from wallets`;
  await sql`delete from events`;
  await sql`delete from stalls`;
  await sql`delete from session where "userId" <> ${"admin"}`;
  await sql`delete from account where "userId" <> ${"admin"}`;
  await sql`delete from user_state where user_id <> ${"admin"}`;
  await sql`delete from "user" where id <> ${"admin"}`;
}

function stallUserId(personId: string) {
  return `loc-s-${personId.toLowerCase()}`;
}
function ownerUserId(personId: string) {
  return `loc-m-${personId.toLowerCase()}`;
}

export async function ensureGtaPeople(sql: Sql) {
  const live = await sql<{ n: number }>`
    select count(*)::int as n from stalls where person_id is not null
  `;
  if (Number(live[0]?.n ?? 0) > 0) return;
  const hash = await hashPassword(PASSWORD);
  const owners = seed.owners as SeedOwner[];
  const stalls = seed.stalls as SeedStall[];
  for (const o of owners) {
    await ensureCredential(sql, ownerUserId(o.person_id), o.name, o.email, "male", hash, o.person_id);
  }
  for (const s of stalls) {
    const sid = stallUserId(s.person_id);
    const email = `${s.person_id.toLowerCase()}@stall.xiangce.app`;
    await ensureCredential(sql, sid, s.name, email, "stall", hash, s.person_id);
    const ownerId = ownerUserId(s.owner_person_id);
    const tags = JSON.stringify(["visit", "night"]);
    const places = JSON.stringify(["你家", "酒店", "她家"]);
    const services = JSON.stringify(s.condom === "必须带套" ? ["口交", "性交"] : ["口交", "性交", "内射"]);
    const points = JSON.stringify(s.sellingPoints);
    const extras = JSON.stringify([]);
    await sql`
      insert into stalls (
        id, user_id, name, age, height_cm, cup, tags, image, online,
        hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
        relation, weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level,
        orgasm, feel, persona, selling_points, hours_tag, daily_quota, travel,
        condom, extras, review_pref, deposit_fen, person_id, location_id, lat, lng
      ) values (
        ${s.person_id}, ${sid}, ${s.name}, ${s.age}, ${s.heightCm}, ${s.cup},
        ${tags}::jsonb, ${s.image}, ${true},
        ${s.hourFen}, ${s.nightFen}, ${s.etaMin}, ${places}::jsonb, ${s.bio}, ${services}::jsonb,
        ${`可上门 · 约 ${s.etaMin} 分钟抵达`}, ${ownerId},
        ${s.relation}, ${s.weightKg}, ${s.identity}, ${s.job}, ${s.personality}, ${s.marriage},
        ${s.demeanor}, ${s.moan}, ${s.skillLevel}, ${s.orgasm}, ${s.feel}, ${s.persona},
        ${points}::jsonb, ${s.hoursTag}, ${s.dailyQuota}, ${s.travel},
        ${s.condom}, ${extras}::jsonb, ${s.reviewPref}, ${5000}, ${s.person_id}, ${s.person_id}, ${s.lat}, ${s.lng}
      )
      on conflict (id) do nothing
    `;
  }
}
