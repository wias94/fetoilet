import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import {
  listMessagesFor,
  listThreadsFor,
  openThreadFor,
  sendMessageFor,
} from "@/lib/messages";

export const Route = createFileRoute("/api/mail/$")({
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

async function handle(method: string, request: Request) {
  try {
    const auth = request.headers.get("authorization");
    const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : undefined;
    const who = await getSessionUser(bearer);
    if (!who?.id) return json({ error: "先登录" }, 401);

    const path = new URL(request.url).pathname.replace(/^\/api\/mail\/?/, "").replace(/\/$/, "");
    const threadMatch = path.match(/^t\/([^/]+)$/);

    if (method === "GET" && path === "threads") {
      return json({ threads: await listThreadsFor(who.id) });
    }
    if (method === "POST" && path === "threads") {
      const body = (await request.json().catch(() => ({}))) as { stallId?: string };
      if (!body.stallId) return json({ error: "缺对象" }, 400);
      return json(await openThreadFor(who.id, body.stallId));
    }
    if (threadMatch && method === "GET") {
      return json(await listMessagesFor(who.id, threadMatch[1]));
    }
    if (threadMatch && method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { text?: string };
      const text = String(body.text ?? "").trim();
      if (!text) return json({ error: "先写一句" }, 400);
      return json(await sendMessageFor(who.id, threadMatch[1], text.slice(0, 2000)));
    }
    return json({ error: "没有这个接口" }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "失败";
    const status = message === "Unauthorized" ? 401 : 400;
    return json({ error: message }, status);
  }
}
