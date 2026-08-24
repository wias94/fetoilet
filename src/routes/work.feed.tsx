import { createFileRoute, Navigate } from "@tanstack/react-router";
import { WorkShell } from "@/components/work-shell";
import { FeedList } from "@/components/feed-list";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/work/feed")({ component: WorkFeedPage });

function WorkFeedPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <WorkShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </WorkShell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/work/feed" }} />;
  return (
    <WorkShell>
      <p className="text-sm text-muted">给男性看的近况</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">动态</h1>
      <div className="mt-5">
        <FeedList compose />
      </div>
    </WorkShell>
  );
}
