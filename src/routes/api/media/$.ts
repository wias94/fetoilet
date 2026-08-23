import { createFileRoute } from "@tanstack/react-router";
import { getR2Object } from "@/lib/r2.server";

export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/api\/media\//, ""));
        if (!/^stalls\/[a-zA-Z0-9_-]+\.jpg$/.test(key)) {
          return new Response("not found", { status: 404 });
        }
        try {
          const file = await getR2Object(key);
          return new Response(Buffer.from(file.bytes), {
            headers: {
              "content-type": file.contentType,
              "cache-control": "public, max-age=86400",
            },
          });
        } catch {
          return new Response("not found", { status: 404 });
        }
      },
    },
  },
});
