import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fetchNearby } from "@/lib/nearby";
import { formatDistance } from "@/lib/geo";
import { readBrowserFix } from "@/lib/browser-geo";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/nearby")({
  component: NearbyPage,
});

type NearbyResult = Awaited<ReturnType<typeof fetchNearby>>;

function NearbyPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-fg/10" />
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/nearby" }} />;
  return (
    <AppShell>
      <NearbyList />
    </AppShell>
  );
}

function NearbyList() {
  const [data, setData] = useState<NearbyResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const fix = await readBrowserFix();
        const next = await fetchNearby({ data: fix ?? {} });
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "附近暂时读不到");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hint =
    data?.source === "gps"
      ? "按你此刻的定位，半径 3 公里"
      : data?.source === "saved"
        ? "按本账户上次坐标，半径 3 公里"
        : "还没有定位，看不见附近的肉厕";

  return (
    <div>
      <p className="text-sm text-muted">就近选用</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">附近肉厕</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{hint}</p>

      {loading ? (
        <div className="mt-6 space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-fg/10" />
          <div className="h-24 animate-pulse rounded-2xl bg-fg/10" />
          <div className="h-24 animate-pulse rounded-2xl bg-fg/10" />
        </div>
      ) : error ? (
        <p className="mt-6 rounded-2xl bg-sunken px-4 py-5 text-sm text-muted">{error}</p>
      ) : !data?.stalls.length ? (
        <p className="mt-6 rounded-2xl bg-sunken px-4 py-5 text-sm text-muted">
          3 公里内暂无可点肉厕。位置会随人移动，过几分钟再看。
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {data.stalls.map((s) => (
            <li key={s.id}>
              <Link
                to="/p/$id"
                params={{ id: s.id }}
                className="flex gap-3 overflow-hidden rounded-2xl bg-surface shadow-border"
              >
                <img src={s.image} alt="" className="h-28 w-24 shrink-0 object-cover" />
                <div className="min-w-0 flex-1 py-3 pr-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-display text-lg font-semibold">
                      {s.name}
                      <span className="ml-1.5 font-sans text-sm font-normal text-muted">{s.age}</span>
                    </p>
                    <span className="shrink-0 text-xs text-live">{formatDistance(s.distance_m)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {s.persona ? `${s.persona} · ` : ""}
                    {s.heightCm}cm/{s.weightKg || "—"}kg
                    {s.unowned ? " · 无主" : ""}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="tabular-nums">{formatFen(s.hourFen)}/次</span>
                    <span className="text-xs text-muted">
                      {s.online ? "可点单" : "休息"} · 约 {s.etaMin} 分钟
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
