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
  const rows = await sql<{ id: string }>`
    update stalls
    set busy_until = now() + interval '30 minutes',
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
