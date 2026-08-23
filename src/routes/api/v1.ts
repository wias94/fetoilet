import { createFileRoute } from "@tanstack/react-router";
import { API_CONTRACT, json } from "@/lib/api-http";

export const Route = createFileRoute("/api/v1")({
  server: {
    handlers: {
      GET: async () => json(API_CONTRACT),
    },
  },
});
