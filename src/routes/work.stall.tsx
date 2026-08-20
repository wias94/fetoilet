import { createFileRoute, Navigate } from "@tanstack/react-router";
import { WorkShell } from "@/components/work-shell";
import { StallEditor } from "@/components/stall-editor";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/work/stall")({ component: WorkStallPage });

function WorkStallPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <WorkShell>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-fg/10" />
      </WorkShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/work/stall" }} />;
  }

  return (
    <WorkShell>
      <StallEditor />
    </WorkShell>
  );
}
