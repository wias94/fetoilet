import { createFileRoute } from "@tanstack/react-router";
import { API_CONTRACT, json } from "@/lib/api-http";

export const Route = createFileRoute("/api/v1")({
  server: {
    handlers: {
      GET: async () => {
        void import("@/lib/sim-loop").then((m) => m.startSimLoop()).catch(() => undefined);
        return json(API_CONTRACT);
      },
    },
  },
});
