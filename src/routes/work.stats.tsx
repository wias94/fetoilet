import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { WorkShell } from "@/components/work-shell";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/stars";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyStallStats, type StallStats } from "@/lib/stall-stats";
import { cn, formatFen, formatRating } from "@/lib/utils";

export const Route = createFileRoute("/work/stats")({ component: WorkStatsPage });

function WorkStatsPage() {
  const { user, isPending } = useCurrentUserState();
  const [stats, setStats] = useState<StallStats | null | undefined>(undefined);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    getMyStallStats()
      .then((row) => {
        if (!cancelled) setStats(row);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

  if (isPending || stats === undefined) {
    return (
      <WorkShell>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-fg/10" />
      </WorkShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/work/stats" }} />;
  }

  if (!stats) {
    return (
      <WorkShell>
        <p className="text-sm text-muted">肉厕端 · 使用与灌注数据</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">尚未办理挂牌</h1>
        <p className="mt-2 text-sm text-muted">请先将身体登记为公共肉厕。被点单、灌注次数将记入本厕档案。</p>
        <Button className="mt-6" asChild>
          <Link to="/work/stall">办理肉厕挂牌</Link>
        </Button>
      </WorkShell>
    );
  }

  const maxUsed = Math.max(1, ...stats.days.map((d) => d.used));

  return (
    <WorkShell>
      <p className="text-sm text-muted">肉厕端 · 使用与灌注数据</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{stats.stallName}</h1>
      <p className="mt-1 text-sm text-muted">
        {stats.online ? "本厕已上架，可供点单灌注" : "本厕已下架，货架暂不展示"}
        {stats.hasOwner ? " · 有所属人，收益按持有周数分成" : " · 无主，被使用后收益为零"}
      </p>

      <section className="mt-5 rounded-2xl bg-surface px-5 py-6 shadow-border">
        <p className="text-sm text-muted">今日被灌注</p>
        <p className="mt-1 font-display text-4xl font-semibold tracking-tight tabular-nums">
          {stats.todayUsed} 次
        </p>
        <p className="mt-2 text-sm text-muted">
          {stats.hasOwner
            ? `名下第 ${stats.holdWeeks + 1} 周。外人使用后主人拿 ${stats.ownerSharePct}%，平台抽 ${stats.platformSharePct}%。主人自用免费。`
            : "无主肉厕。被使用后收益为零。可将便器口令交付客户申请收编。"}
        </p>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCell label="等人来灌注" value={String(stats.todayPending)} />
        <StatCell label="坑上有人" value={String(stats.todayActive)} />
        <StatCell label="今日拒灌注" value={String(stats.todayRejected)} />
        <StatCell
          label="开门率"
          value={stats.acceptRate == null ? "—" : `${stats.acceptRate}%`}
        />
      </div>

      <section className="mt-3 rounded-2xl bg-surface px-5 py-5 shadow-border">
        <p className="text-sm text-muted">男人给这具货打的分</p>
        <div className="mt-2 flex items-center gap-2">
          <Stars value={stats.ratingAvg} size="sm" />
          <span className="text-sm">{formatRating(stats.ratingAvg, stats.ratingCount)}</span>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <section className="rounded-2xl bg-surface px-5 py-5 shadow-border">
          <p className="text-sm text-muted">这周被灌注</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {formatFen(stats.weekFen)}
          </p>
          <p className="mt-1 text-sm text-subtle">当马桶冲了 {stats.weekUsed} 次</p>
        </section>
        <section className="rounded-2xl bg-surface px-5 py-5 shadow-border">
          <p className="text-sm text-muted">一共被冲</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {formatFen(stats.allFen)}
          </p>
          <p className="mt-1 text-sm text-subtle">这具便器总共被用 {stats.allUsed} 次</p>
        </section>
      </div>

      <section className="mt-3 rounded-2xl bg-surface px-5 py-5 shadow-border">
        <p className="text-sm text-muted">这周每天被拿去冲</p>
        <div className="mt-4 flex h-28 items-end gap-2">
          {stats.days.map((d) => (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-20 w-full items-end justify-center">
                <div
                  className={cn("w-3 rounded-sm", d.used > 0 ? "bg-fg" : "bg-sunken")}
                  style={{ height: `${Math.max(d.used > 0 ? 12 : 4, Math.round((d.used / maxUsed) * 80))}px` }}
                />
              </div>
              <p className="text-xs text-subtle">{weekdayLabel(d.date)}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkShell>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-5 py-4 shadow-border">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function weekdayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  const todayKey = new Date(today.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  if (isoDate === todayKey) return "今";
  return "日一二三四五六"[new Date(utc).getUTCDay()] ?? "";
}
