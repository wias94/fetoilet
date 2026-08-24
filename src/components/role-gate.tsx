import { useEffect, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimMyRole, type AccountRole } from "@/lib/roles";

export function RoleGate({ side }: { side: AccountRole }) {
  const { user, isPending } = useCurrentUserState();
  const [role, setRole] = useState<AccountRole | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setRole(null);
      return;
    }
    let cancelled = false;
    void claimMyRole({ data: { role: side } })
      .then((row) => {
        if (!cancelled) setRole(row.role);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        if (message.includes("肉厕账号")) setRole("stall");
        else if (message.includes("客户账号")) setRole("male");
        else setRole(side);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, side]);

  if (!user || isPending || role === undefined) return null;
  if (role === "stall" && side === "male") return <Navigate to="/work" />;
  if (role === "male" && side === "stall") return <Navigate to="/" />;
  return null;
}
