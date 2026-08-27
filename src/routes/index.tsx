import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileCard } from "@/components/profile-card";
import { Splash } from "@/components/splash";
import { Input } from "@/components/ui/input";
import { useEntry } from "@/lib/entry";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TAGS, type Profile, type TagId, onlineCount, searchProfiles } from "@/lib/profiles";
import { readBrowserFix } from "@/lib/browser-geo";
import { listVisibleStalls } from "@/lib/nearby";
import { BroadcastBanner } from "@/components/broadcast-banner";
import { cn, greetingForHour } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const entered = useEntry((s) => s.entered);
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg">
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <div className="h-8 w-28 animate-pulse rounded-lg bg-fg/10" />
          <div className="mt-4 h-40 animate-pulse rounded-2xl bg-fg/10" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (!entered) return <Splash />;
    return <Navigate to="/login" search={{ redirect: "/" }} />;
  }

  return (
    <AppShell>
      <HomeFeed />
    </AppShell>
  );
}

function HomeFeed() {
  const [stalls, setStalls] = useState<Profile[] | null>(null);
  const [source, setSource] = useState<"gps" | "saved" | "none" | "">("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<TagId | "all">("all");
  const [shelf, setShelf] = useState<"all" | "unowned" | "sale">("all");
  const [hello, setHello] = useState("本所营业中");

  useEffect(() => {
    setHello(greetingForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fix = await readBrowserFix();
      const next = await listVisibleStalls({ data: fix ?? {} });
      if (cancelled) return;
      setStalls(next.stalls);
      setSource(next.source);
    })().catch(() => {
      if (!cancelled) setStalls([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo(() => {
    const rows = searchProfiles(stalls ?? [], query, tag);
    if (shelf === "unowned") return rows.filter((p) => p.unowned);
    if (shelf === "sale") return rows.filter((p) => Boolean(p.listedFen));
    return rows;
  }, [stalls, query, tag, shelf]);

  const hint =
    source === "none"
      ? "还没有定位。允许定位后，只能看到 3 公里内的肉厕。"
      : source === "gps"
        ? `附近 3 公里可点单 ${onlineCount(stalls ?? [])} 具。`
        : `按你当前位置 3 公里，可点单 ${onlineCount(stalls ?? [])} 具。`;

  return (
    <div>
      <BroadcastBanner audience="seeker" />
      <p className="text-sm text-muted">{hello}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight">
        附近肉厕
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {hint} 货架只展示此刻你身边的。名下的母亲、女儿不在 3 公里内也不能点。
      </p>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["all", "全部货"],
            ["unowned", "无主 · 可收编"],
            ["sale", "挂牌转让"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setShelf(id)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm",
              shelf === id ? "bg-fg text-bg" : "bg-surface text-fg shadow-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜肉便器、上门、车里、通宵"
          className="pl-10"
          type="search"
        />
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTag(t.id)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm",
              tag === t.id ? "bg-fg text-bg" : "bg-surface text-fg shadow-border",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {stalls == null ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="h-56 animate-pulse rounded-2xl bg-fg/10" />
          <div className="h-56 animate-pulse rounded-2xl bg-fg/10" />
          <div className="h-56 animate-pulse rounded-2xl bg-fg/10" />
        </div>
      ) : list.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">
          {source === "none"
            ? "没有定位，看不到附近的肉厕。"
            : shelf === "sale"
              ? "附近没人挂牌。"
              : "3 公里内没有肉厕。"}
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
