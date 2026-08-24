import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { runtimeEnv } from "@/lib/runtime-env";
import { ADMIN_EMAIL, ADMIN_LOGIN } from "@/lib/auth/login-email";

export const ADMIN_COOKIE = "xc_admin";
export const ADMIN_PASSWORD = "P@ssw0rd";

function secret() {
  return runtimeEnv("ADMIN_SESSION_SECRET") || ADMIN_PASSWORD;
}

export function signAdminToken() {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${ADMIN_LOGIN}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [user, exp, sig] = parts;
  if (user !== ADMIN_LOGIN || !exp || !sig) return false;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(`${user}.${exp}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readAdminCookie(request?: Request | null) {
  const req = request ?? getRequest();
  const raw = req?.headers.get("cookie") ?? "";
  const match = raw.split(/;\s*/).find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(ADMIN_COOKIE.length + 1)) : "";
}

export function isAdminSession(request?: Request | null) {
  return verifyAdminToken(readAdminCookie(request));
}

export function adminCookieHeader(token: string, request?: Request | null) {
  const req = request ?? getRequest();
  const secure = (req?.url ?? "").startsWith("https:");
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure ? "; Secure" : ""}`;
}

export function clearAdminCookieHeader(request?: Request | null) {
  const req = request ?? getRequest();
  const secure = (req?.url ?? "").startsWith("https:");
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function checkAdminPassword(username: string, password: string) {
  const userOk = username.trim().toLowerCase() === ADMIN_LOGIN;
  const pass = Buffer.from(password);
  const expected = Buffer.from(ADMIN_PASSWORD);
  const passOk = pass.length === expected.length && timingSafeEqual(pass, expected);
  return userOk && passOk;
}

export function adminContext() {
  return { userId: "admin", email: ADMIN_EMAIL };
}
