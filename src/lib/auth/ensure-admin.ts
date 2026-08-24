import { createServerFn } from "@tanstack/react-start";
import { ensureAdminAccount } from "@/lib/auth/admin-account";

export const ensureAdminReady = createServerFn({ method: "GET" }).handler(async () => {
  await ensureAdminAccount();
  return { ok: true as const };
});
