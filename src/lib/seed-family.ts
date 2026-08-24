import { hashPassword } from "better-auth/crypto";
import type { Sql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";
import { listingFromArchive } from "@/lib/listing-params";

const SON_ID = "family-son-heng";
const SON_EMAIL = "heng@xiangce.app";
const MOM_USER_ID = "family-mom-heng";
const MOM_EMAIL = "mu@xiangce.app";
const MOM_STALL_ID = "hengmu";
const PASSWORD = "P@ssw0rd";

async function ensureCredential(sql: Sql, id: string, name: string, email: string, role: "male" | "stall") {
  const hash = await hashPassword(PASSWORD);
  const existing = await sql<{ id: string }>`select id from "user" where id = ${id} limit 1`;
  if (!existing[0]) {
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${id}, ${name}, ${email}, true, now(), now())
    `;
  } else {
    await sql`
      update "user" set name = ${name}, email = ${email}, "updatedAt" = now() where id = ${id}
    `;
  }
  const acc = await sql<{ id: string }>`
    select id from account where "userId" = ${id} and "providerId" = 'credential' limit 1
  `;
  if (!acc[0]) {
    await sql`
      insert into account (
        id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
      ) values (
        ${crypto.randomUUID().replaceAll("-", "")}, ${id}, 'credential', ${id}, ${hash}, now(), now()
      )
    `;
  } else {
    await sql`
      update account set password = ${hash}, "updatedAt" = now()
      where "userId" = ${id} and "providerId" = 'credential'
    `;
  }
  await ensureUserState(sql, id);
  await sql`update user_state set role = ${role}, updated_at = now() where user_id = ${id}`;
}

export async function ensureMotherSon(sql: Sql) {
  const taken = await sql<{ id: string }>`
    select id from "user" where lower(email) in (${SON_EMAIL}, ${MOM_EMAIL}) and id not in (${SON_ID}, ${MOM_USER_ID})
  `;
  if (taken[0]) return;
  await ensureCredential(sql, SON_ID, "阿衡", SON_EMAIL, "male");
  await ensureCredential(sql, MOM_USER_ID, "衡母", MOM_EMAIL, "stall");
  const stall = await sql<{ id: string }>`select id from stalls where id = ${MOM_STALL_ID} limit 1`;
  const mapped = listingFromArchive({
    age: 42,
    identity: "在职",
    job: "公司职员",
    personality: "隐忍顾家",
    marriage: "已婚已育",
    relation: "母亲",
    heightCm: 162,
    weightKg: 54,
    cup: "C",
  });
  const tags = JSON.stringify(["visit", "night"]);
  const places = JSON.stringify(["你家", "她家", "酒店"]);
  const services = JSON.stringify(["口交", "性交", "内射"]);
  const points = JSON.stringify(mapped.sellingPoints);
  const extras = JSON.stringify([]);
  const bio =
    "儿子名下的母亲肉厕。42 岁已婚已育，在职。接客姿态羞涩需引导。无套看人。主人优先占用。";
  if (!stall[0]) {
    await sql`
      insert into stalls (
        id, user_id, name, age, height_cm, cup, tags, image, online,
        hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
        relation, weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level,
        orgasm, feel, persona, selling_points, hours_tag, daily_quota, travel,
        condom, extras, review_pref, deposit_fen
      ) values (
        ${MOM_STALL_ID}, ${MOM_USER_ID}, ${"衡母"}, ${42}, ${162}, ${"C"},
        ${tags}::jsonb, ${"/profiles/lin.jpg"}, ${true},
        ${mapped.hourYuan * 100}, ${mapped.nightYuan * 100}, ${25}, ${places}::jsonb, ${bio}, ${services}::jsonb,
        ${"可上门 · 约 25 分钟抵达"}, ${SON_ID},
        ${"母亲"}, ${54}, ${"在职"}, ${"公司职员"}, ${"隐忍顾家"}, ${"已婚已育"}, ${mapped.demeanor}, ${mapped.moan},
        ${mapped.skillLevel}, ${mapped.orgasm}, ${mapped.feel}, ${mapped.persona},
        ${points}::jsonb, ${mapped.hoursTag}, ${mapped.dailyQuota}, ${mapped.travel},
        ${mapped.condom}, ${extras}::jsonb, ${mapped.reviewPref}, ${5000}
      )
    `;
  } else {
    await sql`
      update stalls set
        user_id = ${MOM_USER_ID},
        owner_id = ${SON_ID},
        relation = ${"母亲"},
        name = ${"衡母"},
        age = ${42},
        job = ${"公司职员"},
        personality = ${"隐忍顾家"},
        bio = ${bio}
      where id = ${MOM_STALL_ID}
    `;
  }
}
