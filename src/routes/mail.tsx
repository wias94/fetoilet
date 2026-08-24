import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listThreads } from "@/lib/mail-api";
import type { Thread } from "@/lib/messages";

export const Route = createFileRoute("/mail")({ component: MailPage });

function MailPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Thread[] | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    async function load() {
      try {
        const list = await listThreads();
        if (!cancelled) setRows(list);
      } catch {
        if (!cancelled) setRows([]);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isPending, user]);

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/mail" }} />;

  return (
    <AppShell>
      <p className="text-sm text-muted">与在册肉厕的往来函件。点开对话就能打字。</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">私信</h1>
      <ul className="mt-5 space-y-2">
        {rows === null && <li className="h-20 animate-pulse rounded-2xl bg-fg/10" />}
        {rows?.length === 0 && <p className="py-12 text-center text-sm text-muted">还没有私信。去资料页点私信。</p>}
        {rows?.map((t) => (
          <li key={t.id}>
            <Link
              to="/mail/$id"
              params={{ id: t.id }}
              className="flex gap-3 rounded-2xl bg-surface p-3 shadow-border"
            >
              <img src={t.stallImage} alt="" className="size-12 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{t.peerName}</p>
                  {t.unread > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-fg">{t.unread}</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted">{t.lastBody || "点进去说话"}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
