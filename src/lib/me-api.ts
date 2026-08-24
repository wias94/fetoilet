import { getBearerToken } from "@/lib/auth/client";
import type { AccountRole } from "@/lib/roles";

export type MeRow = {
  role: AccountRole | null;
  admin: boolean;
  to: string;
};

async function meFetch(init?: RequestInit): Promise<MeRow> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const token = getBearerToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch("/api/me", { credentials: "include", ...init, headers });
  const json = (await res.json().catch(() => ({}))) as MeRow & { error?: string };
  if (!res.ok) throw new Error(json.error || "先登录");
  return json;
}

export function fetchMyRole() {
  return meFetch();
}

export function enterAs(intended?: AccountRole) {
  return meFetch({
    method: "POST",
    body: JSON.stringify({ intended }),
  });
}
