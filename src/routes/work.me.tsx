import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { WorkShell } from "@/components/work-shell";
import { AuthSlot, SignOutButton } from "@/components/auth-slot";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyStall, type MineStall } from "@/lib/stalls";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/work/me")({ component: WorkMePage });

function WorkMePage() {
  const { user, isPending } = useCurrentUserState();
  const [stall, setStall] = useState<MineStall | null | undefined>(undefined);

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
      <h1 className="font-display text-3xl font-semibold tracking-tight">肉厕端 · 这具货</h1>
      <div className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex items-center gap-3">
          <AuthSlot to="/work/me" />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName ?? "这具马桶"}</p>
            <p className="truncate text-sm text-muted">{user.primaryEmail}</p>
          </div>
        </div>
      </div>

      {stall ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-border">
          <p className="text-sm text-muted">正在出货的这具</p>
          <p className="mt-1 font-display text-xl font-semibold">{stall.name}</p>
          <p className="mt-1 text-sm text-muted">
            {stall.area} · 灌一次 {formatFen(stall.hourFen)} · {stall.online ? "可灌" : "不给用"}
            {stall.hasOwner ? " · 有主，钱归主人" : " · 无主，灌了没人收钱"}
          </p>
          {stall.stallToken && (
            <p className="mt-3 font-display text-xl font-semibold tracking-widest">{stall.stallToken}</p>
          )}
          <p className="mt-1 text-xs text-subtle">便器口令。给男人，他能收编这具。有主之后不能再用这串抢。</p>
          {stall.stallToken && (
            <Button
              className="mt-3"
              variant="secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(stall.stallToken ?? "").then(
                  () => toast("口令复制了"),
                  () => toast(stall.stallToken),
                );
              }}
            >
              复制便器口令
            </Button>
          )}
          <Button className="mt-3" variant="secondary" asChild>
            <Link to="/work/stall">改这具马桶的挂牌</Link>
          </Button>
        </div>
      ) : stall === null ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-border">
          <p className="font-display text-lg">这具货还没挂</p>
          <Button className="mt-4" asChild>
            <Link to="/work/stall">把身体登记成公厕</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <Button variant="secondary" asChild>
          <Link to="/work/stats">看这具马桶被男人灌了多少</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/">去男人那端找坑</Link>
        </Button>
        <Link to="/admin" className="text-center text-sm text-subtle hover:text-muted">
          管事台
        </Link>
        <SignOutButton home="/work" />
      </div>
    </WorkShell>
  );
}
