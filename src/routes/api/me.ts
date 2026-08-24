import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { finishLoginFor, homeForRole, isAdminUser, resolveRole } from "@/lib/roles";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: (ctx) => handle("GET", ctx.request),
      POST: (ctx) => handle("POST", ctx.request),
    },
  },
});

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function handle(method: string, request?: Request) {
  try {
    const auth = request?.headers.get("authorization") ?? null;
    const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : undefined;
    const who = await getSessionUser(bearer);
    if (!who?.id) return json({ error: "先登录" }, 401);
    if (method === "GET") {
      const admin = await isAdminUser(who.id);
      const role = admin ? null : await resolveRole(who.id);
      return json({
        role,
        admin,
        to: admin ? "/admin" : homeForRole(role),
      });
    }
    const body = (await request?.json().catch(() => ({}))) as { intended?: "male" | "stall" };
    const intended = body.intended === "stall" || body.intended === "male" ? body.intended : undefined;
    return json(await finishLoginFor(who.id, intended));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "失败" }, 400);
  }
}
