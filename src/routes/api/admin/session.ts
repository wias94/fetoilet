import { createFileRoute } from "@tanstack/react-router";
import {
  adminCookieHeader,
  adminContext,
  checkAdminPassword,
  clearAdminCookieHeader,
  isAdminSession,
  signAdminToken,
} from "@/lib/auth/admin-session.server";

export const Route = createFileRoute("/api/admin/session")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!isAdminSession(request)) {
          return Response.json({ ok: false }, { status: 401 });
        }
        return Response.json({ ok: true, ...adminContext() });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
        if (!checkAdminPassword(String(body.username ?? ""), String(body.password ?? ""))) {
          return Response.json({ ok: false, error: "账号或密码不对" }, { status: 401 });
        }
        return Response.json(
          { ok: true, ...adminContext() },
          { headers: { "set-cookie": adminCookieHeader(signAdminToken(), request) } },
        );
      },
      DELETE: ({ request }) => {
        return Response.json({ ok: true }, { headers: { "set-cookie": clearAdminCookieHeader(request) } });
      },
    },
  },
});
