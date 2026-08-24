import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fetchMyRole } from "@/lib/me-api";
import { homeForRole, type AccountRole } from "@/lib/roles";

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
    void fetchMyRole()
      .then((row) => {
        if (cancelled) return;
        if (row.admin) {
          setRole(null);
          return;
        }
        setRole(row.role);
        if (row.role && row.role !== side) {
          window.location.replace(homeForRole(row.role));
        }
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, side]);

  if (!user || isPending || role === undefined) return null;
  return null;
}
