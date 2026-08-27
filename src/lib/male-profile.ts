import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { BudgetBand, CondomPref, SessionStyle } from "@/lib/male-params";

/** Sim/plugin read path. Not shown in the client app. */
export type MaleBehavior = {
  userId: string;
  personId: string | null;
  job: string;
  familyStatus: string;
  taste: Record<string, number>;
  sessionStyle: SessionStyle;
  condomPref: CondomPref;
  objectify: number;
  novelty: number;
  risk: number;
  budgetBand: BudgetBand;
  simEnabled: boolean;
};

export const getMyMaleBehavior = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      person_id: string | null;
      job: string;
      family_status: string;
      taste: Record<string, number> | string;
      session_style: string;
      condom_pref: string;
      objectify: number;
      novelty: number;
      risk: number;
      budget_band: string;
      sim_enabled: boolean;
    }>`
      select user_id, person_id, job, family_status, taste, session_style, condom_pref,
             objectify, novelty, risk, budget_band, sim_enabled
      from behavior_male where user_id = ${context.userId} limit 1
    `;
    const r = rows[0];
    if (!r) return null;
    const taste = typeof r.taste === "string" ? (JSON.parse(r.taste) as Record<string, number>) : r.taste;
    return {
      userId: r.user_id,
      personId: r.person_id,
      job: r.job,
      familyStatus: r.family_status,
      taste,
      sessionStyle: r.session_style as SessionStyle,
      condomPref: r.condom_pref as CondomPref,
      objectify: Number(r.objectify),
      novelty: Number(r.novelty),
      risk: Number(r.risk),
      budgetBand: r.budget_band as BudgetBand,
      simEnabled: Boolean(r.sim_enabled),
    } satisfies MaleBehavior;
  });
