import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/lib/admin-gate";
import { adminListUsers, type AdminUserRow } from "@/lib/admin";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminListUsers()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminGate>
      <p className="text-sm text-muted">管理台</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">用户</h1>
      {error && <p className="mt-4 text-sm text-muted">{error === "Forbidden" ? "本账号无管理权限。" : error}</p>}
      <div className="mt-6 overflow-x-auto rounded-2xl bg-surface shadow-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium">名</th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium">挂的货</th>
              <th className="px-4 py-3 font-medium">注册</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3 text-muted">{row.email}</td>
                <td className="px-4 py-3">{row.stallName ?? "—"}</td>
                <td className="px-4 py-3 text-subtle">{row.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminGate>
  );
}
