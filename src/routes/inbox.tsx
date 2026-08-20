import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listInquiries, type Inquiry } from "@/lib/inquiries";
import { getProfile } from "@/lib/profiles";
import { listPublicStalls } from "@/lib/stalls";

export const Route = createFileRoute("/inbox")({
  loader: () => listPublicStalls(),
  component: InboxPage,
});

function InboxPage() {
  const stalls = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    listInquiries()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "加载失败";
        setError(message === "Unauthorized" ? "unauthorized" : message);
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

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
      <h1 className="font-display text-3xl font-semibold tracking-tight">已订</h1>
      <p className="mt-1 text-sm text-muted">叫过来的肉便器，等人开坑</p>

      {error && error !== "unauthorized" && <p className="mt-6 text-sm text-muted">{error}</p>}

      {rows && rows.length === 0 && (
        <div className="mt-12 rounded-2xl bg-surface px-6 py-12 text-center shadow-border">
          <p className="font-display text-lg">还没方便过</p>
          <p className="mt-1 text-sm text-muted">去附近挑一具会走过来的肉便器</p>
          <Button className="mt-5" asChild>
            <Link to="/">去找坑</Link>
          </Button>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {rows?.map((row) => {
          const profile = getProfile(row.profileId, stalls);
          return (
            <li key={row.id}>
              <Link
                to="/p/$id"
                params={{ id: row.profileId }}
                className="flex gap-3 rounded-2xl bg-surface p-3 shadow-border"
              >
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
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
