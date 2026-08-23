import { getRequest } from "@tanstack/react-start/server";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { SHANGHAI_FAKE } from "@/lib/geo";
import { EVENT_KINDS } from "@/lib/behavior";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function apiError(message: string, status: number) {
  return json({ ok: false, error: message }, status);
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("JSON 解析失败");
  }
}

export function apiPath(request: Request) {
  const url = new URL(request.url);
  return url.pathname.replace(/^\/api\/v1\/?/, "").replace(/\/$/, "");
}

export const API_CONTRACT = {
  version: 1,
  auth: {
    user: "登录后的 Cookie，或 Authorization: Bearer <session>",
    admin: "管事账号的 Cookie，或请求头 x-admin-key: <ADMIN_API_KEY>",
  },
  fake_gps: {
    note: "测试时 source 用 fake，坐标用下面预设或自己填",
    shanghai: SHANGHAI_FAKE,
    body: {
      lat: 31.1883,
      lng: 121.437,
      accuracy_m: 15,
      heading: 0,
      speed_mps: 0,
      source: "fake",
    },
  },
  events: {
    kinds: EVENT_KINDS,
    body: { kind: "page_view", target_id: "/inbox", payload: {}, lat: 31.1883, lng: 121.437 },
  },
  endpoints: [
    { method: "GET", path: "/api/v1", auth: "none", desc: "这份说明" },
    { method: "GET", path: "/api/v1/me", auth: "user", desc: "当前用户 + 是否封禁 + 最后位置" },
    { method: "GET", path: "/api/v1/location", auth: "user", desc: "读自己位置" },
    { method: "PUT", path: "/api/v1/location", auth: "user", desc: "上报/伪 GPS" },
    { method: "GET", path: "/api/v1/nearby?lat=&lng=&radius_m=3000", auth: "user", desc: "附近的货。不传 lat/lng 就用自己最后一次位置" },
    { method: "POST", path: "/api/v1/events", auth: "user", desc: "上报行为" },
    { method: "GET", path: "/api/v1/events", auth: "user", desc: "自己的行为记录" },
    { method: "GET", path: "/api/v1/admin/users", auth: "admin", desc: "用户列表" },
    { method: "GET", path: "/api/v1/admin/users/:id", auth: "admin", desc: "单个用户" },
    {
      method: "PATCH",
      path: "/api/v1/admin/users/:id",
      auth: "admin",
      desc: "封禁、改位置、强制关坑",
      body: {
        banned: true,
        ban_reason: "spam",
        stall_online: false,
        location: { lat: 31.1883, lng: 121.437, source: "fake" },
      },
    },
    { method: "GET", path: "/api/v1/admin/events?user_id=&kind=&limit=50", auth: "admin", desc: "全站行为" },
    { method: "GET", path: "/api/v1/admin/locations", auth: "admin", desc: "所有人最后位置" },
  ],
};

export async function requireApiUser() {
  const request = getRequest();
  const user = await getSessionUser();
  if (!user?.id) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  void request;
  return user;
}

export async function requireApiAdmin() {
  const request = getRequest();
  if (!request) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  const key = process.env.ADMIN_API_KEY?.trim();
  const given = request.headers.get("x-admin-key")?.trim();
  if (key && given && given === key) {
    return { userId: "admin-key", email: "admin-key" };
  }
  const user = await getSessionUser();
  if (!user?.id || !user.email) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select email from admins where lower(email) = ${user.email.trim().toLowerCase()} limit 1
  `;
  if (!rows[0]) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return { userId: user.id, email: user.email };
}
