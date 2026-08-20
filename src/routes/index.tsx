import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileCard } from "@/components/profile-card";
import { Splash } from "@/components/splash";
import { Input } from "@/components/ui/input";
import { useEntry } from "@/lib/entry";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AREAS, TAGS, type TagId, onlineCount, searchProfiles } from "@/lib/profiles";
import { listPublicStalls } from "@/lib/stalls";
import { cn, greetingForHour } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => listPublicStalls(),
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
  const stalls = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<TagId | "all">("all");
  const [area, setArea] = useState<string>("附近");
  const [hello, setHello] = useState("晚上了，去方便");

  useEffect(() => {
    setHello(greetingForHour(new Date().getHours()));
  }, []);

  const list = useMemo(
    () => searchProfiles(stalls, query, tag, area),
    [stalls, query, tag, area],
  );

  return (
    <div>
      <p className="text-sm text-muted">{hello}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight">
        附近的肉便器
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        男人急了就近找坑。现在 {onlineCount(stalls)} 具可冲，会走过来当马桶。酒店、车里、你家都能泄。不要跟它说话。
      </p>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(a)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm",
              area === a ? "bg-fg text-bg" : "bg-surface text-fg shadow-border",
            )}
          >
            {a}
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

      {list.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">这片没有肉便器。换个区再找。</p>
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
