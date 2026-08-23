import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminGate } from "@/lib/admin-gate";
import { adminListStalls, adminPatchStall, type AdminStallRow } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/admin/stalls")({ component: AdminStalls });

function AdminStalls() {
  const [rows, setRows] = useState<AdminStallRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminListStalls()
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

  async function patch(id: string, data: { online?: boolean; featured?: boolean; hidden?: boolean }) {
    setBusy(id);
    try {
      await adminPatchStall({ data: { id, ...data } });
      setRows((cur) => cur?.map((row) => (row.id === id ? { ...row, ...data } : row)) ?? null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "没改成");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminGate>
      <p className="text-sm text-muted">管事台</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">货</h1>
      <p className="mt-2 text-sm text-muted">置顶就是推到货架前面。藏起来男人端看不见。</p>
      {error && <p className="mt-4 text-sm text-muted">{error === "Forbidden" ? "这个号不是管事的。" : error}</p>}
      <ul className="mt-6 space-y-3">
        {rows?.map((row) => (
          <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-border">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {row.name}
                <span className="ml-2 text-sm font-normal text-muted">{row.area}</span>
              </p>
              <p className="text-sm tabular-nums">{formatFen(row.hourFen)}/冲</p>
            </div>
            <p className="mt-1 text-sm text-subtle">
              {row.online ? "出货中" : "收着"}
              {row.featured ? " · 置顶" : ""}
              {row.hidden ? " · 已藏" : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === row.id}
                onClick={() => void patch(row.id, { online: !row.online })}
              >
                {row.online ? "收坑" : "开坑"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === row.id}
                onClick={() => void patch(row.id, { featured: !row.featured })}
              >
                {row.featured ? "取消置顶" : "置顶推流"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === row.id}
                onClick={() => void patch(row.id, { hidden: !row.hidden })}
              >
                {row.hidden ? "放回货架" : "从货架藏掉"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </AdminGate>
  );
}
