import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminGate } from "@/lib/admin-gate";
import { adminOverview, type AdminOverview } from "@/lib/admin";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminOverview()
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "加载失败";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminGate>
      <p className="text-sm text-muted">管理台</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">总览</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">查阅用户、在册肉厕与订单，并向货架及肉厕端推送公告。</p>
      {error === "Unauthorized" ? (
        <p className="mt-6 text-sm text-muted">先登录。</p>
      ) : error === "Forbidden" ? (
        <p className="mt-6 text-sm text-muted">本账号无管理权限。</p>
      ) : error ? (
        <p className="mt-6 text-sm text-muted">{error}</p>
      ) : null}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cell label="用户" value={String(data.users)} to="/admin/users" />
          <Cell label="货" value={String(data.stalls)} to="/admin/stalls" />
          <Cell label="正在出货" value={String(data.online)} to="/admin/stalls" />
          <Cell label="单" value={String(data.orders)} to="/admin/orders" />
          <Cell label="灌完" value={String(data.used)} to="/admin/orders" />
          <Cell label="评价" value={String(data.reviews)} to="/admin/orders" />
          <div className="rounded-2xl bg-surface px-5 py-4 shadow-border">
            <p className="text-sm text-muted">平台抽成</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatFen(data.platformFen)}</p>
          </div>
        </div>
      )}
    </AdminGate>
  );
}

function Cell({
  label,
  value,
  to,
}: {
  label: string;
  value: string;
  to: "/admin/users" | "/admin/stalls" | "/admin/orders";
}) {
  return (
    <Link to={to} className="rounded-2xl bg-surface px-5 py-4 shadow-border">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
