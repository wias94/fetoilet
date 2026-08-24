import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminGate } from "@/lib/admin-gate";
import {
  adminListBroadcasts,
  adminPushBroadcast,
  adminToggleBroadcast,
  type Broadcast,
} from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/push")({ component: AdminPush });

function AdminPush() {
  const [rows, setRows] = useState<Broadcast[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "seeker" | "stall">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminListBroadcasts()
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

  async function push() {
    if (!title.trim() || !body.trim()) {
      toast("标题和正文都要");
      return;
    }
    setBusy(true);
    try {
      await adminPushBroadcast({ data: { title: title.trim(), body: body.trim(), audience } });
      const list = await adminListBroadcasts();
      setRows(list);
      setTitle("");
      setBody("");
      toast("已推出去");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没推成");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await adminToggleBroadcast({ data: { id, active } });
      setRows((cur) => cur?.map((row) => (row.id === id ? { ...row, active } : row)) ?? null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "没改成");
    }
  }

  return (
    <AdminGate>
      <p className="text-sm text-muted">管理台</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">推流</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">
        推一条通知到男人货架或肉厕端。开着的最新一条会顶在页面上。货的置顶在「货」里做。
      </p>
      {error && <p className="mt-4 text-sm text-muted">{error === "Forbidden" ? "本账号无管理权限。" : error}</p>}

      <div className="mt-6 space-y-3 rounded-2xl bg-surface p-4 shadow-border">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" maxLength={40} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="正文" maxLength={200} />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "两边都灌"],
              ["seeker", "只灌男人端"],
              ["stall", "只灌肉厕端"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAudience(id)}
              className={cn(
                "h-9 rounded-full px-3.5 text-sm",
                audience === id ? "bg-fg text-bg" : "bg-sunken text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button className="w-full" disabled={busy} onClick={() => void push()}>
          {busy ? "在推…" : "推出去"}
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {rows?.map((row) => (
          <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-border">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{row.title}</p>
              <p className="text-xs text-subtle">{row.active ? "在流" : "停了"}</p>
            </div>
            <p className="mt-1 text-sm text-muted">{row.body}</p>
            <p className="mt-2 text-xs text-subtle">
              {row.audience === "all" ? "两边" : row.audience === "seeker" ? "男人端" : "肉厕端"}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => void toggle(row.id, !row.active)}
            >
              {row.active ? "停掉" : "再开"}
            </Button>
          </li>
        ))}
      </ul>
    </AdminGate>
  );
}
