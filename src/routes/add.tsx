import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StallEditor } from "@/components/stall-editor";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/add")({ component: AddStallPage });

function AddStallPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
      </AppShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/add" }} />;
  }

  return (
    <AppShell>
      <StallEditor createOwned />
    </AppShell>
  );
}
