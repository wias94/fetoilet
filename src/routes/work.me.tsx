import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { WorkShell } from "@/components/work-shell";
import { AuthSlot, SignOutButton } from "@/components/auth-slot";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyStall } from "@/lib/stalls";
import type { Profile } from "@/lib/profiles";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/work/me")({ component: WorkMePage });

function WorkMePage() {
  const { user, isPending } = useCurrentUserState();
  const [stall, setStall] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    getMyStall()
      .then((row) => {
        if (!cancelled) setStall(row);
      })
      .catch(() => {
        if (!cancelled) setStall(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

  if (isPending) {
    return (
      <WorkShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </WorkShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/work/me" }} />;
  }

  return (
    <WorkShell>
      <h1 className="font-display text-3xl font-semibold tracking-tight">便器端 · 我的</h1>
      <div className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex items-center gap-3">
          <AuthSlot to="/work/me" />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName ?? "这具便器"}</p>
            <p className="truncate text-sm text-muted">{user.primaryEmail}</p>
          </div>
        </div>
      </div>

      {stall ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-border">
          <p className="text-sm text-muted">当前坑位</p>
          <p className="mt-1 font-display text-xl font-semibold">{stall.name}</p>
          <p className="mt-1 text-sm text-muted">
            {stall.area} · 冲一次 {formatFen(stall.hourFen)} · {stall.online ? "开着" : "关着"}
          </p>
          <Button className="mt-4" variant="secondary" asChild>
            <Link to="/work/stall">改这具便器</Link>
          </Button>
        </div>
      ) : stall === null ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-border">
          <p className="font-display text-lg">还没坑位</p>
          <Button className="mt-4" asChild>
            <Link to="/work/stall">去登记</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <Button variant="secondary" asChild>
          <Link to="/">去男人那端找坑</Link>
        </Button>
        <SignOutButton home="/work" />
      </div>
    </WorkShell>
  );
}
