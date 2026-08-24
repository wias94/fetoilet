import { hashPassword } from "better-auth/crypto";
import type { Sql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";
import { identityFromJob, listingFromArchive } from "@/lib/listing-params";
import type { Relation } from "@/lib/profiles";
import { JOBS, PERSONALITIES } from "@/lib/listing";

const PASSWORD = "P@ssw0rd";

type PresetPair = {
  stallId: string;
  stallName: string;
  stallEmail: string;
  stallUserId: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  relation: Relation;
  age: number;
  heightCm: number;
  weightKg: number;
  cup: "B" | "C" | "D" | "E";
  job: (typeof JOBS)[number];
  personality: (typeof PERSONALITIES)[number];
  image: string;
  places: string[];
  services: string[];
};

/** 用映射表直接铺出来的样例。密码统一 P@ssw0rd。 */
export const PRESET_PAIRS: PresetPair[] = [
  {
    stallId: "hengmu",
    stallName: "衡母",
    stallEmail: "mu@xiangce.app",
    stallUserId: "family-mom-heng",
    ownerId: "family-son-heng",
    ownerName: "阿衡",
    ownerEmail: "heng@xiangce.app",
    relation: "母亲",
    age: 42,
    heightCm: 162,
    weightKg: 54,
    cup: "C",
    job: "公司职员",
    personality: "隐忍顾家",
    image: "/profiles/lin.jpg",
    places: ["你家", "她家", "酒店"],
    services: ["口交", "性交", "内射"],
  },
  {
    stallId: "zewife",
    stallName: "小泽",
    stallEmail: "zewife@xiangce.app",
    stallUserId: "family-wife-ze",
    ownerId: "family-husband-ze",
    ownerName: "阿泽",
    ownerEmail: "ze@xiangce.app",
    relation: "妻子",
    age: 29,
    heightCm: 164,
    weightKg: 50,
    cup: "C",
    job: "护士",
    personality: "温顺讨好",
    image: "/profiles/wan.jpg",
    places: ["你家", "酒店"],
    services: ["口交", "性交", "乳交", "内射"],
  },
  {
    stallId: "linya",
    stallName: "林芽",
    stallEmail: "ya@xiangce.app",
    stallUserId: "family-dau-ya",
    ownerId: "family-dad-lin",
    ownerName: "林父",
    ownerEmail: "linfu@xiangce.app",
    relation: "女儿",
    age: 19,
    heightCm: 160,
    weightKg: 46,
    cup: "B",
    job: "在校学生",
    personality: "软萌粘人",
    image: "/profiles/ke.jpg",
    places: ["你家", "酒店"],
    services: ["口交", "性交"],
  },
  {
    stallId: "haoqi",
    stallName: "小淇",
    stallEmail: "qi-gf@xiangce.app",
    stallUserId: "family-gf-qi",
    ownerId: "family-hao",
    ownerName: "阿豪",
    ownerEmail: "hao@xiangce.app",
    relation: "女友",
    age: 24,
    heightCm: 168,
    weightKg: 50,
    cup: "C",
    job: "销售",
    personality: "外向热闹",
    image: "/profiles/qi.jpg",
    places: ["你家", "酒店", "车上"],
    services: ["口交", "性交", "深喉", "内射"],
  },
  {
    stallId: "junmei",
    stallName: "阿梅",
    stallEmail: "mei@xiangce.app",
    stallUserId: "family-sis-mei",
    ownerId: "family-bro-jun",
    ownerName: "阿军",
    ownerEmail: "jun@xiangce.app",
    relation: "兄妹",
    age: 22,
    heightCm: 163,
    weightKg: 48,
    cup: "B",
    job: "公司职员",
    personality: "内向闷骚",
    image: "/profiles/bei.jpg",
    places: ["你家", "她家"],
    services: ["口交", "性交", "内射"],
  },
];

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

async function ensurePair(sql: Sql, p: PresetPair) {
  const clash = await sql<{ id: string }>`
    select id from "user"
    where lower(email) in (${p.ownerEmail}, ${p.stallEmail})
      and id not in (${p.ownerId}, ${p.stallUserId})
  `;
  if (clash[0]) return;
  if (p.age < 18) return;
  await ensureCredential(sql, p.ownerId, p.ownerName, p.ownerEmail, "male");
  await ensureCredential(sql, p.stallUserId, p.stallName, p.stallEmail, "stall");
  const marriage =
    p.relation === "母亲" || p.relation === "妻子" ? "已婚已育" : "未婚未育";
  const mapped = listingFromArchive({
    age: p.age,
    identity: identityFromJob(p.job),
    job: p.job,
    personality: p.personality,
    marriage,
    relation: p.relation,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    cup: p.cup,
  });
  const tags = JSON.stringify(["visit", "night"]);
  const places = JSON.stringify(p.places);
  const services = JSON.stringify(p.services);
  const points = JSON.stringify(mapped.sellingPoints);
  const extras = JSON.stringify([]);
  const bio = `${p.ownerName}名下的${p.relation}肉厕。${p.age}岁${p.job}，性格${p.personality}。`;
  const existing = await sql<{ id: string }>`select id from stalls where id = ${p.stallId} limit 1`;
  if (!existing[0]) {
    await sql`
      insert into stalls (
        id, user_id, name, age, height_cm, cup, tags, image, online,
        hour_fen, night_fen, eta_min, places, bio, services, work, owner_id,
        relation, weight_kg, identity, job, personality, marriage, demeanor, moan, skill_level,
        orgasm, feel, persona, selling_points, hours_tag, daily_quota, travel,
        condom, extras, review_pref, deposit_fen
      ) values (
        ${p.stallId}, ${p.stallUserId}, ${p.stallName}, ${p.age}, ${p.heightCm}, ${p.cup},
        ${tags}::jsonb, ${p.image}, ${true},
        ${mapped.hourYuan * 100}, ${mapped.nightYuan * 100}, ${20}, ${places}::jsonb, ${bio}, ${services}::jsonb,
        ${"可上门 · 约 20 分钟抵达"}, ${p.ownerId},
        ${p.relation}, ${p.weightKg}, ${mapped.identity}, ${p.job}, ${p.personality}, ${marriage},
        ${mapped.demeanor}, ${mapped.moan},
        ${mapped.skillLevel}, ${mapped.orgasm}, ${mapped.feel}, ${mapped.persona},
        ${points}::jsonb, ${mapped.hoursTag}, ${mapped.dailyQuota}, ${mapped.travel},
        ${mapped.condom}, ${extras}::jsonb, ${mapped.reviewPref}, ${5000}
      )
    `;
  } else {
    await sql`
      update stalls set
        user_id = ${p.stallUserId},
        owner_id = ${p.ownerId},
        relation = ${p.relation},
        name = ${p.stallName},
        age = ${p.age},
        job = ${p.job},
        personality = ${p.personality},
        identity = ${mapped.identity},
        demeanor = ${mapped.demeanor},
        moan = ${mapped.moan},
        skill_level = ${mapped.skillLevel},
        orgasm = ${mapped.orgasm},
        feel = ${mapped.feel},
        persona = ${mapped.persona},
        selling_points = ${points}::jsonb,
        hours_tag = ${mapped.hoursTag},
        daily_quota = ${mapped.dailyQuota},
        travel = ${mapped.travel},
        condom = ${mapped.condom},
        bio = ${bio}
      where id = ${p.stallId}
    `;
  }
}

export async function ensureMotherSon(sql: Sql) {
  await ensurePresetAccounts(sql);
}

export async function ensurePresetAccounts(sql: Sql) {
  for (const pair of PRESET_PAIRS) {
    await ensurePair(sql, pair);
  }
}
