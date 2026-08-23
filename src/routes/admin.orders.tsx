import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminGate } from "@/lib/admin-gate";
import {
  adminDeleteReview,
  adminListOrders,
  adminListReviews,
  type AdminOrderRow,
  type AdminReviewRow,
} from "@/lib/admin";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrderRow[] | null>(null);
  const [reviews, setReviews] = useState<AdminReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminListOrders(), adminListReviews()])
      .then(([a, b]) => {
        if (cancelled) return;
        setOrders(a);
        setReviews(b);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function dropReview(id: string) {
    try {
      await adminDeleteReview({ data: { id } });
      setReviews((cur) => cur?.filter((r) => r.id !== id) ?? null);
      toast("评删了");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没删成");
    }
  }

  return (
    <AdminGate>
      <p className="text-sm text-muted">管事台</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">单和评价</h1>
      {error && <p className="mt-4 text-sm text-muted">{error === "Forbidden" ? "这个号不是管事的。" : error}</p>}

      <h2 className="mt-6 text-sm font-medium text-muted">最近的单</h2>
      <ul className="mt-3 space-y-2">
        {orders?.map((row) => (
          <li key={row.id} className="rounded-2xl bg-surface px-4 py-3 text-sm shadow-border">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{row.profileName}</p>
              <p className="text-xs text-subtle">{row.createdAt.slice(0, 16).replace("T", " ")}</p>
            </div>
            <p className="mt-1 text-muted">
              {row.slot} · {row.status}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-medium text-muted">评价</h2>
      <ul className="mt-3 space-y-2">
        {reviews?.map((row) => (
          <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-border">
            <p className="text-sm text-muted">
              {row.profileId} · {row.score} 分
            </p>
            <p className="mt-2 text-sm leading-relaxed">{row.comment}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void dropReview(row.id)}>
              删这条
            </Button>
          </li>
        ))}
      </ul>
    </AdminGate>
  );
}
