import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InquirySheet } from "@/components/inquiry-sheet";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/favorites";
import { getPublicStall } from "@/lib/stalls";
import { tagLabel } from "@/lib/profiles";
import { cn, formatFen } from "@/lib/utils";

export const Route = createFileRoute("/p/$id")({
  loader: ({ params }) => getPublicStall({ data: { id: params.id } }),
  component: ProfilePage,
});

function ProfilePage() {
  const profile = Route.useLoaderData();
  const ids = useFavorites((s) => s.ids);
  const toggle = useFavorites((s) => s.toggle);
  const [open, setOpen] = useState(false);

  if (!profile) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-muted">这厕关了</p>
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link to="/">回找厕</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const saved = ids.includes(profile.id);

  return (
    <AppShell>
      <Link to="/" className="inline-flex h-10 items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        找厕
      </Link>

      <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-border md:grid md:grid-cols-2">
        <div className="relative aspect-[2/3] md:aspect-auto md:min-h-[32rem]">
          <img src={profile.image} alt="" className="size-full object-cover object-top" />
          {profile.online && (
            <span className="absolute left-3 top-3 rounded-full bg-bg/70 px-2.5 py-1 text-xs text-live">
              可冲
            </span>
          )}
        </div>
        <div className="flex flex-col p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {profile.name}
                <span className="ml-2 font-sans text-lg font-normal text-muted">{profile.age}</span>
              </h1>
              <p className="mt-1 text-sm text-muted">
                {profile.area} · {profile.heightCm}cm · {profile.cup}杯 · 厕号 {profile.id}
              </p>
              <p className="mt-2 text-sm text-fg">
                {profile.online ? "现在可冲" : "稍后可冲"} · {profile.etaMin} 分钟到 ·{" "}
                {profile.places.join(" / ")}
              </p>
            </div>
            <button
              type="button"
              aria-label={saved ? "取消占坑" : "占坑"}
              onClick={() => toggle(profile.id)}
              className={cn(
                "grid size-11 place-items-center rounded-full bg-sunken",
                saved && "text-primary",
              )}
            >
              <Heart className={cn("size-4", saved && "fill-primary")} />
            </button>
          </div>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">{profile.bio}</p>
          <p className="mt-2 text-sm text-subtle">{profile.work}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.tags.map((t) => (
              <span key={t} className="rounded-full bg-sunken px-3 py-1 text-xs">
                {tagLabel(t)}
              </span>
            ))}
          </div>
          <h2 className="mt-6 font-display text-lg font-semibold">这肉厕怎么冲</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.services.map((s) => (
              <li key={s} className="rounded-full bg-sunken px-3 py-2 text-sm">
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">冲一次</span>
              <span className="tabular-nums font-medium">{formatFen(profile.hourFen)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">通宵占坑</span>
              <span className="tabular-nums font-medium">{formatFen(profile.nightFen)}</span>
            </div>
          </div>
          <Button className="mt-6 w-full" onClick={() => setOpen(true)}>
            叫这厕过来
          </Button>
        </div>
      </div>

      <InquirySheet profile={profile} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
