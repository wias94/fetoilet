import type { Sql } from "@/lib/db";
import {
  earnMultiplier,
  loadMaleEcon,
  stallUsage,
  suggestListFen,
  type EconKey,
} from "@/lib/econ";
import type { Profile } from "@/lib/profiles";
import { PLATFORM_ID, PLATFORM_RENT_FEN, PLATFORM_SALE_FEN } from "@/lib/yield";

export type Market = {
  used7: number;
  online: number;
  busy: number;
  pressure: number;
  mul: number;
};

const DEFAULT_ECON: Record<EconKey, number> = {
  cash_tight: 0.4,
  bargain: 0.4,
  flip: 0.4,
  hold: 0.4,
  rent: 0.4,
  prestige: 0.4,
  family_liquidate: 0.4,
  use_over_own: 0.4,
};

export async function loadMarket(sql: Sql): Promise<Market> {
  const rows = await sql<{ used7: number; online: number; busy: number }>`
    select
      (select count(*)::int from inquiries
        where coalesce(status, 'pending') = 'used'
          and coalesce(updated_at, created_at) >= now() - interval '7 days') as used7,
      (select count(*)::int from stalls where online and coalesce(hidden, false) = false) as online,
      (select count(*)::int from stalls
        where online and busy_until is not null and busy_until > now()) as busy
  `;
  const used7 = Number(rows[0]?.used7 ?? 0);
  const online = Math.max(1, Number(rows[0]?.online ?? 1));
  const busy = Number(rows[0]?.busy ?? 0);
  const per = used7 / online;
  const pressure = Math.min(1, Math.max(0, per / 2.2 * 0.65 + (busy / online) * 0.35));
  const mul = 0.72 + 0.58 * pressure;
  return { used7, online, busy, pressure, mul };
}

export async function loadOwnerEcons(sql: Sql, ownerIds: string[]) {
  const ids = [...new Set(ownerIds.filter((id) => id && id !== PLATFORM_ID && !id.startsWith("seed:")))];
  const map = new Map<string, Record<EconKey, number>>();
  if (!ids.length) return map;
  const rows = await sql.query<Record<EconKey, number> & { user_id: string }>(
    `select user_id, cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own
     from behavior_econ where user_id = any($1::text[])`,
    [ids],
  );
  for (const r of rows) {
    map.set(r.user_id, {
      cash_tight: Number(r.cash_tight),
      bargain: Number(r.bargain),
      flip: Number(r.flip),
      hold: Number(r.hold),
      rent: Number(r.rent),
      prestige: Number(r.prestige),
      family_liquidate: Number(r.family_liquidate),
      use_over_own: Number(r.use_over_own),
    });
  }
  return map;
}

function ownerRentMul(e: Record<EconKey, number>, marketMul: number) {
  let m = marketMul;
  if (e.hold > 0.6) m = 1 + (m - 1) * 0.4;
  if (e.flip > 0.6) m = 1 + (m - 1) * 1.25;
  const markup = 0.8 + e.prestige * 0.4 - e.cash_tight * 0.22;
  return m * markup;
}

export function quoteRentFen(opts: {
  ownerId: string | null | undefined;
  baseHourFen: number;
  market: Market;
  econ?: Record<EconKey, number>;
  used7?: number;
  usedAll?: number;
  weeks?: number;
}) {
  if (!opts.ownerId || opts.ownerId === PLATFORM_ID) return PLATFORM_RENT_FEN;
  const base = Math.max(50, opts.baseHourFen || PLATFORM_RENT_FEN);
  const e = opts.econ ?? DEFAULT_ECON;
  const earn = earnMultiplier(opts.used7 ?? 0, opts.usedAll ?? 0, opts.weeks ?? 0);
  const fen = Math.round((base * ownerRentMul(e, opts.market.mul) * earn) / 50) * 50;
  return Math.max(Math.round(base * 0.55), Math.min(Math.round(base * 1.85), Math.max(50, fen)));
}

export function quoteSaleFen(opts: {
  ownerId: string | null | undefined;
  profile: Profile;
  baseHourFen: number;
  market: Market;
  econ?: Record<EconKey, number>;
  used7?: number;
  usedAll?: number;
}) {
  if (!opts.ownerId || opts.ownerId === PLATFORM_ID) return PLATFORM_SALE_FEN;
  const e = opts.econ ?? DEFAULT_ECON;
  const book = suggestListFen(
    { ...opts.profile, hourFen: opts.baseHourFen },
    { used7: opts.used7, usedAll: opts.usedAll },
  );
  let fen = book * opts.market.mul * (0.88 + e.prestige * 0.25 - e.flip * 0.12);
  if (e.family_liquidate > 0.55 && ["母亲", "妻子", "女儿", "兄妹"].includes(opts.profile.relation ?? "")) {
    fen *= 1.02;
  }
  return Math.max(100, Math.round(fen / 100) * 100);
}

export async function applyLivePrices(
  sql: Sql,
  rows: { id: string; owner_id?: string | null; hour_fen: number; base_hour_fen?: number | null; listed_fen?: number | null }[],
  profiles: Profile[],
) {
  if (!rows.length) return profiles;
  const market = await loadMarket(sql);
  const usage = await stallUsage(sql, rows.map((r) => r.id));
  const econs = await loadOwnerEcons(
    sql,
    rows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)),
  );
  return profiles.map((p, i) => {
    const row = rows[i];
    if (!row) return p;
    const u = usage.get(p.id);
    const econ = row.owner_id ? econs.get(row.owner_id) : undefined;
    const base = Number(row.base_hour_fen ?? row.hour_fen);
    const hourFen = quoteRentFen({
      ownerId: row.owner_id,
      baseHourFen: base,
      market,
      econ,
      used7: u?.used7,
      usedAll: u?.usedAll,
      weeks: p.holdWeeks,
    });
    const listed =
      row.listed_fen == null && row.owner_id !== PLATFORM_ID
        ? p.listedFen
        : quoteSaleFen({
            ownerId: row.owner_id,
            profile: { ...p, hourFen: base },
            baseHourFen: base,
            market,
            econ,
            used7: u?.used7,
            usedAll: u?.usedAll,
          });
    return {
      ...p,
      hourFen,
      listedFen:
        row.owner_id === PLATFORM_ID
          ? PLATFORM_SALE_FEN
          : row.listed_fen == null
            ? null
            : listed,
    };
  });
}

export async function quoteStallNow(
  sql: Sql,
  stall: {
    id: string;
    owner_id: string | null;
    hour_fen: number;
    base_hour_fen?: number | null;
    relation: string | null;
    owned_at: string | null;
  },
) {
  const { holdingCut } = await import("@/lib/yield");
  const cut = holdingCut(stall.relation, stall.owned_at);
  const market = await loadMarket(sql);
  const usage = await stallUsage(sql, [stall.id]);
  const u = usage.get(stall.id);
  const econ = stall.owner_id && stall.owner_id !== PLATFORM_ID ? await loadMaleEcon(sql, stall.owner_id) : undefined;
  return quoteRentFen({
    ownerId: stall.owner_id,
    baseHourFen: Number(stall.base_hour_fen ?? stall.hour_fen),
    market,
    econ,
    used7: u?.used7,
    usedAll: u?.usedAll,
    weeks: cut.weeks,
  });
}
