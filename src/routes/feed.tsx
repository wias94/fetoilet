import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FeedList } from "@/components/feed-list";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/feed")({ component: FeedPage });

function FeedPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/feed" }} />;
  return (
    <AppShell>
      <p className="text-sm text-muted">在册肉厕发布的近况</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">动态</h1>
      <div className="mt-5">
        <FeedList />
      </div>
    </AppShell>
  );
}
