import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { enterAs } from "@/lib/me-api";

type EnterSearch = { side?: "male" | "stall" };

export const Route = createFileRoute("/enter")({
  validateSearch: (s: Record<string, unknown>): EnterSearch => ({
    side: s.side === "stall" ? "stall" : s.side === "male" ? "male" : undefined,
  }),
  component: Enter,
});

function Enter() {
  const { side } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      window.location.replace(side === "stall" ? "/login?redirect=/work" : "/login");
      return;
    }
    let cancelled = false;
    void enterAs(side)
      .then((row) => {
        if (!cancelled) window.location.replace(row.to);
      })
      .catch(() => {
        if (!cancelled) window.location.replace(side === "stall" ? "/login?redirect=/work" : "/login");
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, side]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg text-fg">
      <p className="text-sm text-muted">正在进入对应端…</p>
    </main>
  );
}
