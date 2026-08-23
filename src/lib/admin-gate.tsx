import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <AdminShell>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-fg/10" />
      </AdminShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/admin" }} />;
  }

  return <AdminShell>{children}</AdminShell>;
}
