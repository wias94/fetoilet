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
      <h1 className="font-display text-3xl font-semibold tracking-tight">肉厕端 · 本厕档案</h1>
      <div className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex items-center gap-3">
          <AuthSlot to="/work/me" />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName ?? "在册肉厕"}</p>
            <p className="truncate text-sm text-muted">{user.primaryEmail}</p>
          </div>
        </div>
      </div>

      {stall ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-border">
          <p className="text-sm text-muted">当前挂牌</p>
          <p className="mt-1 font-display text-xl font-semibold">{stall.name}</p>
          <p className="mt-1 text-sm text-muted">
            {stall.area} · 单次 {formatFen(stall.hourFen)} · {stall.online ? "可点单" : "已下架"}
            {stall.hasOwner ? " · 有所属人，收益归所属人" : " · 无主，被使用后收益为零"}
          </p>
          {stall.stallToken && (
            <p className="mt-3 font-display text-xl font-semibold tracking-widest">{stall.stallToken}</p>
          )}
          <p className="mt-1 text-xs text-subtle">便器口令。交付客户后可用于收编本厕。一经有所属人，本口令即失效。</p>
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
            <Link to="/work/stall">修订本厕挂牌</Link>
          </Button>
        </div>
      ) : stall === null ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-border">
          <p className="font-display text-lg">尚未办理挂牌</p>
          <Button className="mt-4" asChild>
            <Link to="/work/stall">将身体登记为公共肉厕</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <Button variant="secondary" asChild>
          <Link to="/work/stats">查阅本厕被使用与灌注数据</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/">前往客户交易所</Link>
        </Button>
        <Link to="/admin" className="text-center text-sm text-subtle hover:text-muted">
          管理台
        </Link>
        <SignOutButton home="/work" />
      </div>
    </WorkShell>
  );
}
