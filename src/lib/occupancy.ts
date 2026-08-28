import type { Sql } from "@/lib/db";

/** 出租占用时长。转让挂牌 listed_fen 不走这套。 */
export const RENT_SESSION_MIN = 30;

export function isBusy(busyUntil: string | Date | null | undefined, now = new Date()) {
  if (!busyUntil) return false;
  const t = busyUntil instanceof Date ? busyUntil.getTime() : Date.parse(busyUntil);
  return Number.isFinite(t) && t > now.getTime();
}

export async function releaseExpiredRentals(sql: Sql) {
  await sql`
    update inquiries i
    set status = 'cancelled', updated_at = now()
    from stalls s
    where s.busy_inquiry_id = i.id
      and s.busy_until is not null
      and s.busy_until <= now()
      and coalesce(i.status, 'pending') in ('pending', 'accepted', 'arrived')
  `;
  await sql`
    update stalls
    set busy_until = null, busy_inquiry_id = null, updated_at = now()
    where busy_until is not null and busy_until <= now()
  `;
}

export async function lockRental(sql: Sql, stallId: string, inquiryId: string) {
  const { loadSimConfig } = await import("@/lib/sim-config");
  const cfg = await loadSimConfig(sql);
  const rows = await sql<{ id: string }>`
    update stalls
    set busy_until = now() + make_interval(mins => ${cfg.rentSessionMin}),
        busy_inquiry_id = ${inquiryId},
        updated_at = now()
    where id = ${stallId}
      and online = true
      and (busy_until is null or busy_until <= now())
    returning id
  `;
  return Boolean(rows[0]);
}

export async function unlockRental(sql: Sql, inquiryId: string) {
  await sql`
    update stalls
    set busy_until = null, busy_inquiry_id = null, updated_at = now()
    where busy_inquiry_id = ${inquiryId}
  `;
}

/** 厌腻只看累计使用量，和持有周数无关。 */
export function satiationFromUses(uses: number, halfUses: number) {
  const n = Math.max(0, uses);
  const h = Math.max(0.01, halfUses);
  return 1 - Math.exp(-n / h);
}

export async function bumpSatiation(sql: Sql, maleId: string, stallId: string, amount = 1) {
  await sql`
    insert into behavior_satiation (male_id, stall_id, uses, value, updated_at)
    values (${maleId}, ${stallId}, 1, ${amount}, now())
    on conflict (male_id, stall_id) do update set
      uses = behavior_satiation.uses + 1,
      value = behavior_satiation.value + ${amount},
      updated_at = now()
  `;
}

/** 厌腻按使用次数，抽成按周。两头都够且 keep 低于阈值才挂。 */
export async function maybeListFromBoredom(sql: Sql, ownerId: string, stallId: string) {
  if (!ownerId || ownerId === "platform" || ownerId.startsWith("seed:")) return null;
  const stall = await sql<{
    listed_fen: number | null;
    hour_fen: number;
    base_hour_fen: number | null;
    relation: string | null;
    owned_at: string | null;
    name: string;
  }>`
    select listed_fen, hour_fen, base_hour_fen, relation, owned_at, name
    from stalls where id = ${stallId} and owner_id = ${ownerId} limit 1
  `;
  if (!stall[0] || stall[0].listed_fen != null) return null;
  const { loadSimConfig } = await import("@/lib/sim-config");
  const cfg = await loadSimConfig(sql);
  const { holdingCut } = await import("@/lib/yield");
  const cut = holdingCut(stall[0].relation, stall[0].owned_at, new Date(), cfg);
  if (cut.platformSharePct <= 0) return null;
  if (cfg.buyCooldownHours > 0 && stall[0].owned_at) {
    const owned = Date.parse(stall[0].owned_at);
    if (Number.isFinite(owned) && Date.now() - owned < cfg.buyCooldownHours * 3600_000) return null;
  }
  const sat = await sql<{ uses: number; value: number }>`
    select uses, value from behavior_satiation
    where male_id = ${ownerId} and stall_id = ${stallId} limit 1
  `;
  const uses = Number(sat[0]?.value ?? sat[0]?.uses ?? 0);
  const sat01 = satiationFromUses(uses, cfg.satiationHalfUses);
  const keep = (cut.ownerSharePct / 100) * (1 - sat01);
  if (keep >= cfg.listKeepThreshold) return null;
  const { loadMaleEcon, stallUsage } = await import("@/lib/econ");
  const econ = await loadMaleEcon(sql, ownerId);
  const { quoteSaleFen, loadMarket } = await import("@/lib/pricing");
  const market = await loadMarket(sql);
  const usage = await stallUsage(sql, [stallId]);
  const fen = quoteSaleFen({
    ownerId,
    profile: {
      hourFen: Number(stall[0].base_hour_fen ?? stall[0].hour_fen),
      relation: stall[0].relation,
      holdWeeks: cut.weeks,
      ownerSharePct: cut.ownerSharePct,
    } as import("@/lib/profiles").Profile,
    baseHourFen: Number(stall[0].base_hour_fen ?? stall[0].hour_fen),
    market,
    econ,
    used7: usage.get(stallId)?.used7,
    usedAll: usage.get(stallId)?.usedAll,
  });
  await sql`
    update stalls set listed_fen = ${fen}, updated_at = now()
    where id = ${stallId} and owner_id = ${ownerId} and listed_fen is null
  `;
  return fen;
}
