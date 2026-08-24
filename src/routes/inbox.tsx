import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ReviewForm } from "@/components/review-form";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  cancelInquiry,
  useInquiry,
  listInquiries,
  seekerStatusLabel,
  type Inquiry,
} from "@/lib/inquiries";
import { listMyReviewedIds } from "@/lib/reviews";
import { claimAfterUse } from "@/lib/owners";
import { getProfile } from "@/lib/profiles";
import { listPublicStalls } from "@/lib/stalls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inbox")({
  loader: () => listPublicStalls(),
  component: InboxPage,
});

function InboxPage() {
  const stalls = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string[]>([]);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    async function load() {
      try {
        const [list, ids] = await Promise.all([listInquiries(), listMyReviewedIds()]);
        if (!cancelled) {
          setRows(list);
          setReviewed(ids);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "加载失败";
        setError(message === "Unauthorized" ? "unauthorized" : message);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isPending, user]);

  async function cancel(id: string) {
    setActing(id);
    try {
      const next = await cancelInquiry({ data: { id } });
      setRows((cur) => cur?.map((row) => (row.id === id ? next : row)) ?? null);
      toast("已取消");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没取消成");
    } finally {
      setActing(null);
    }
  }

  async function useStall(id: string) {
    setActing(id);
    try {
      const next = await useInquiry({ data: { id } });
      setRows((cur) => cur?.map((row) => (row.id === id ? next : row)) ?? null);
      toast("已确认使用本肉厕");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没用成");
    } finally {
      setActing(null);
    }
  }

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-fg/10" />
      </AppShell>
    );
  }

  if (!user || error === "unauthorized") {
    return <Navigate to="/login" search={{ redirect: "/inbox" }} />;
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold tracking-tight">订单</h1>
      <p className="mt-1 text-sm text-muted">已提交之点单。肉厕接单后显示履约进度。</p>

      {error && error !== "unauthorized" && <p className="mt-6 text-sm text-muted">{error}</p>}

      {rows && rows.length === 0 && (
        <div className="mt-12 rounded-2xl bg-surface px-6 py-12 text-center shadow-border">
          <p className="font-display text-lg">暂无订单</p>
          <p className="mt-1 text-sm text-muted">请从在册肉厕中提交点单</p>
          <Button className="mt-5" asChild>
            <Link to="/">前往选厕</Link>
          </Button>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {rows?.map((row) => {
          const profile = getProfile(row.profileId, stalls);
          return (
            <li key={row.id} className="rounded-2xl bg-surface p-3 shadow-border">
              <Link to="/p/$id" params={{ id: row.profileId }} className="flex gap-3">
                {profile && (
                  <img
                    src={profile.image}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.profileName}</p>
                  <p className="mt-0.5 text-sm text-muted">{row.slot}</p>
                  {row.note && <p className="mt-1 truncate text-sm text-subtle">{row.note}</p>}
                  <p
                    className={cn(
                      "mt-2 text-sm",
                      row.status === "accepted" || row.status === "arrived" || row.status === "used"
                        ? "text-live"
                        : row.status === "pending"
                          ? "text-fg"
                          : "text-subtle",
                    )}
                  >
                    {seekerStatusLabel(row.status)}
                  </p>
                </div>
              </Link>
              {row.status === "pending" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  disabled={acting === row.id}
                  onClick={() => void cancel(row.id)}
                >
                  取消
                </Button>
              )}
              {row.status === "arrived" && (
                <Button
                  className="mt-3 w-full"
                  disabled={acting === row.id}
                  onClick={() => void useStall(row.id)}
                >
                  确认使用本肉厕
                </Button>
              )}
              {row.status === "used" && profile && profile.unowned && !claimed.includes(row.profileId) && (
                <Button
                  className="mt-3 w-full"
                  variant="secondary"
                  disabled={acting === row.id}
                  onClick={() => {
                    setActing(row.id);
                    void claimAfterUse({ data: { inquiryId: row.id } })
                      .then((res) => {
                        toast(`收编了 ${res.name}`);
                        setClaimed((cur) => [...cur, res.id]);
                      })
                      .catch((err) => toast(err instanceof Error ? err.message : "没收成"))
                      .finally(() => setActing(null));
                  }}
                >
                  收编该无主肉厕
                </Button>
              )}
              {row.status === "used" && !reviewed.includes(row.profileId) && (
                <div className="mt-3">
                  <ReviewForm
                    profileId={row.profileId}
                    name={row.profileName}
                    onDone={() => setReviewed((cur) => [...cur, row.profileId])}
                  />
                </div>
              )}
              {row.status === "used" && reviewed.includes(row.profileId) && (
                <p className="mt-3 text-sm text-subtle">已评过这具便器</p>
              )}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
