import type { Sql } from "@/lib/db";
import { ensureUserState } from "@/lib/behavior";
import { deriveEcon } from "@/lib/econ";
import { deriveMale, type LocationAxes, type TasteKey } from "@/lib/male-params";
import { loadSimConfig } from "@/lib/sim-config";
import { drawWealthFen, scaleToMean } from "@/lib/wealth";
import { PRESET_PAIRS, ensurePresetAccounts } from "@/lib/seed-family";
import { hashPassword } from "better-auth/crypto";

const XUHUI = { lat: 31.1883, lng: 121.437 };
const PASSWORD = "P@ssw0rd";
let hashed: string | null = null;

async function hashedPass() {
  if (!hashed) hashed = await hashPassword(PASSWORD);
  return hashed;
}

const WANDERERS = [
  { id: "sim-wan-zhao", name: "阿钞", email: "zhao@xiangce.app", family: 0.18, nightlife: 0.78 },
  { id: "sim-wan-chen", name: "阿晨", email: "chen@xiangce.app", family: 0.22, nightlife: 0.62 },
  { id: "sim-wan-bo", name: "阿博", email: "bo@xiangce.app", family: 0.28, nightlife: 0.55 },
  { id: "sim-wan-kai", name: "阿凯", email: "kai@xiangce.app", family: 0.12, nightlife: 0.84 },
];

function hash01(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1_000_003) / 1_000_003;
}

function fixFor(id: string, spread = 0.01) {
  const lat = XUHUI.lat + (hash01(id) - 0.5) * spread;
  const lng = XUHUI.lng + (hash01(id + ":lng") - 0.5) * spread * 1.15;
  return { lat, lng };
}

function axes(family: number, nightlife: number): LocationAxes {
  return {
    sociability: 0.45 + nightlife * 0.25,
    routine_preference: 0.55 - nightlife * 0.2,
    spontaneity: 0.35 + nightlife * 0.35,
    travel_tolerance: 0.45,
    nightlife_preference: nightlife,
    activity_budget: 0.48,
    family_orientation: family,
    warmth: 0.4 + family * 0.25,
    directness: 0.5,
    patience: 0.45,
    communication_style: "",
    personality_summary: "",
  };
}

async function ensureCredential(sql: Sql, id: string, name: string, email: string, role: "male" | "stall") {
  const existing = await sql<{ id: string }>`select id from "user" where id = ${id} limit 1`;
  if (!existing[0]) {
    const hash = await hashedPass();
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${id}, ${name}, ${email}, true, now(), now())
    `;
    await sql`
      insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${crypto.randomUUID().replaceAll("-", "")}, ${id}, 'credential', ${id}, ${hash}, now(), now())
    `;
  }
  await ensureUserState(sql, id);
  await sql`update user_state set role = ${role}, updated_at = now() where user_id = ${id}`;
}

async function putFix(sql: Sql, userId: string, lat: number, lng: number, copyStall: boolean) {
  await sql`
    update user_state
    set lat = ${lat}, lng = ${lng}, loc_source = 'fake', loc_updated_at = now(), updated_at = now()
    where user_id = ${userId}
  `;
  if (copyStall) {
    await sql`update stalls set lat = ${lat}, lng = ${lng}, updated_at = now() where user_id = ${userId}`;
  }
}

async function writeMaleBehavior(
  sql: Sql,
  userId: string,
  ax: LocationAxes,
  owned: Partial<Record<TasteKey, number>>,
  extra: { familyStatus?: string; age?: number } = {},
) {
  const derived = deriveMale(ax, owned, extra);
  const econ = deriveEcon({
    budgetBand: derived.budget_band,
    activityBudget: ax.activity_budget,
    novelty: derived.novelty,
    spontaneity: ax.spontaneity,
    routine: ax.routine_preference,
    risk: derived.risk,
    objectify: derived.objectify,
    familyOrientation: ax.family_orientation,
    sessionStyle: derived.session_style,
  });
  await sql`
    insert into behavior_person (
      person_id, sociability, routine_preference, spontaneity, travel_tolerance,
      nightlife_preference, activity_budget, family_orientation, warmth, directness, patience
    ) values (
      ${userId}, ${ax.sociability}, ${ax.routine_preference}, ${ax.spontaneity}, ${ax.travel_tolerance},
      ${ax.nightlife_preference}, ${ax.activity_budget}, ${ax.family_orientation}, ${ax.warmth}, ${ax.directness}, ${ax.patience}
    )
    on conflict (person_id) do nothing
  `;
  await sql`
    insert into behavior_male (
      user_id, person_id, job, family_status, taste, session_style, condom_pref,
      objectify, novelty, risk, budget_band, sim_enabled
    ) values (
      ${userId}, ${userId}, ${""}, ${extra.familyStatus ?? ""},
      ${JSON.stringify(derived.taste)}::jsonb, ${derived.session_style}, ${derived.condom_pref},
      ${derived.objectify}, ${derived.novelty}, ${derived.risk}, ${derived.budget_band}, true
    )
    on conflict (user_id) do update set
      sim_enabled = true,
      taste = coalesce(behavior_male.taste, excluded.taste)
  `;
  await sql`
    insert into behavior_econ (
      user_id, cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own
    ) values (
      ${userId}, ${econ.cash_tight}, ${econ.bargain}, ${econ.flip}, ${econ.hold},
      ${econ.rent}, ${econ.prestige}, ${econ.family_liquidate}, ${econ.use_over_own}
    )
    on conflict (user_id) do nothing
  `;
}

async function seedWallets(sql: Sql) {
  const cfg = await loadSimConfig(sql);
  const males = await sql<{ id: string; cash_tight: number | null; prestige: number | null; budget_band: string | null }>`
    select u.id, e.cash_tight, e.prestige, m.budget_band
    from "user" u
    join user_state s on s.user_id = u.id and s.role = 'male'
    left join behavior_econ e on e.user_id = u.id
    left join behavior_male m on m.user_id = u.id
    where u.id <> 'platform'
  `;
  if (!males.length) return;
  const raw = males.map((r) =>
    drawWealthFen(r.id, cfg.wealthMeanCad, {
      cashTight: Number(r.cash_tight ?? 0.4),
      prestige: Number(r.prestige ?? 0.4),
      budgetBand: r.budget_band ?? "中",
    }),
  );
  const scaled = scaleToMean(raw, cfg.wealthMeanCad);
  for (let i = 0; i < males.length; i += 1) {
    const id = males[i]?.id;
    const fen = scaled[i] ?? 10000;
    if (!id) continue;
    const have = await sql<{ fen: number }>`select fen from wallets where user_id = ${id} limit 1`;
    if (have[0]) continue;
    await sql`insert into wallets (user_id, fen) values (${id}, ${fen}) on conflict (user_id) do nothing`;
  }
}

/** 给模拟进程铺一份可跑的附近世界。不改主程序字段。 */
export async function bootstrapSimWorld(sql: Sql) {
  const ready = await sql<{ id: string }>`
    select m.user_id as id
    from behavior_male m
    join stalls s on s.id = 'hengmu'
    where m.user_id = 'sim-wan-zhao' and m.sim_enabled = true
    limit 1
  `;
  const { ensurePlatform, adoptUnownedToPlatform } = await import("@/lib/economy");
  await ensurePlatform(sql);
  if (ready[0]) {
    await adoptUnownedToPlatform(sql);
    await seedWallets(sql);
    return;
  }

  const seeded = await sql<{ id: string }>`select id from stalls where id = 'hengmu' limit 1`;
  if (!seeded[0]) await ensurePresetAccounts(sql);

  for (const p of PRESET_PAIRS) {
    if (p.age < 18) continue;
    const home = fixFor(p.ownerId, 0.008);
    await putFix(sql, p.ownerId, home.lat, home.lng, false);
    await putFix(sql, p.stallUserId, home.lat + 0.0004, home.lng + 0.0003, true);
    const owned: Partial<Record<TasteKey, number>> = { [p.relation]: 1 };
    const family =
      p.relation === "母亲" || p.relation === "妻子" || p.relation === "女儿" || p.relation === "兄妹" ? 0.82 : 0.38;
    await writeMaleBehavior(sql, p.ownerId, axes(family, 1 - family * 0.5), owned, {
      familyStatus: p.relation === "女儿" ? "成年孩子" : p.relation === "妻子" ? "已婚" : "",
      age: p.relation === "女儿" ? 45 : 34,
    });
    await sql`
      update stalls set owned_at = now() - interval '14 days', updated_at = now()
      where id = ${p.stallId} and owner_id = ${p.ownerId}
        and (owned_at is null or owned_at > now() - interval '7 days')
    `;
    await sql`
      insert into behavior_satiation (male_id, stall_id, uses, value, updated_at)
      values (${p.ownerId}, ${p.stallId}, 3, 4, now())
      on conflict (male_id, stall_id) do nothing
    `;
    const { maybeListFromBoredom } = await import("@/lib/occupancy");
    await maybeListFromBoredom(sql, p.ownerId, p.stallId);
  }

  for (const w of WANDERERS) {
    await ensureCredential(sql, w.id, w.name, w.email, "male");
    const home = fixFor(w.id, 0.012);
    await putFix(sql, w.id, home.lat, home.lng, false);
    await writeMaleBehavior(sql, w.id, axes(w.family, w.nightlife), {}, { age: 29 });
  }

  await adoptUnownedToPlatform(sql);
  await seedWallets(sql);
}
