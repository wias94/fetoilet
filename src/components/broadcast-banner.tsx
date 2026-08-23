import { useEffect, useState } from "react";
import { listActiveBroadcast, type Broadcast } from "@/lib/admin";

export function BroadcastBanner({ audience }: { audience: "seeker" | "stall" }) {
  const [row, setRow] = useState<Broadcast | null>(null);
  useEffect(() => {
    let cancelled = false;
    listActiveBroadcast({ data: { audience } })
      .then((next) => {
        if (!cancelled) setRow(next);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);
  if (!row) return null;
  return (
    <div className="mb-5 rounded-2xl bg-surface px-4 py-3 shadow-border">
      <p className="text-xs tracking-widest text-subtle">推流</p>
      <p className="mt-1 font-display text-lg font-semibold">{row.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{row.body}</p>
    </div>
  );
}
