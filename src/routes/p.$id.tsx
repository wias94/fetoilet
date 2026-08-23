import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Heart } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InquirySheet } from "@/components/inquiry-sheet";
import { ReviewForm } from "@/components/review-form";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/favorites";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPublicStall } from "@/lib/stalls";
import { buyStall } from "@/lib/economy";
import { claimByStallToken } from "@/lib/owners";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { tagLabel } from "@/lib/profiles";
import { listInquiries } from "@/lib/inquiries";
import { listStallReviews, type Review } from "@/lib/reviews";
import { cn, formatFen, formatRating } from "@/lib/utils";

export const Route = createFileRoute("/p/$id")({
  loader: ({ params }) => getPublicStall({ data: { id: params.id } }),
  component: ProfilePage,
});

function ProfilePage() {
  const profile = Route.useLoaderData();
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const ids = useFavorites((s) => s.ids);
  const toggle = useFavorites((s) => s.toggle);
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [claimToken, setClaimToken] = useState("");
  const [tradeBusy, setTradeBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    Promise.all([listStallReviews({ data: { profileId: profile.id } }), listInquiries()])
      .then(([list, orders]) => {
        if (cancelled) return;
        setReviews(list);
        setCanReview(orders.some((o) => o.profileId === profile.id && o.status === "used"));
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-fg/10" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: profile ? `/p/${profile.id}` : "/" }}
      />
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-muted">这具便器关了</p>
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link to="/">回找坑</Link>
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
        找坑
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
                {profile.area} · {profile.heightCm}cm · {profile.cup}杯 · 便器号 {profile.id}
              </p>
              <p className="mt-2 text-sm text-fg">
                {profile.online ? "现在可冲" : "稍后可冲"} · {profile.etaMin} 分钟到 ·{" "}
                {profile.places.join(" / ")}
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Stars value={profile.ratingAvg} size="sm" />
                <span>{formatRating(profile.ratingAvg, profile.ratingCount)}</span>
              </div>
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
          <h2 className="mt-6 font-display text-lg font-semibold">这具肉便器怎么冲</h2>
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
            叫这具便器过来
          </Button>
          {!profile.owned && profile.unowned && (
            <div className="mt-4 rounded-2xl bg-sunken p-4">
              <p className="text-sm text-muted">无主货。灌了没人收钱。填它的便器口令就能收编。</p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={claimToken}
                  onChange={(e) => setClaimToken(e.target.value)}
                  placeholder="TC-********"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={tradeBusy}
                  onClick={() => {
                    setTradeBusy(true);
                    void claimByStallToken({ data: { token: claimToken } })
                      .then((row) => {
                        toast(`收编了 ${row.name}`);
                        return router.invalidate();
                      })
                      .catch((err) => toast(err instanceof Error ? err.message : "没收成"))
                      .finally(() => setTradeBusy(false));
                  }}
                >
                  收编
                </Button>
              </div>
            </div>
          )}
          {profile.owned && profile.listedFen ? (
            <Button
              className="mt-3 w-full"
              variant="secondary"
              disabled={tradeBusy}
              onClick={() => {
                setTradeBusy(true);
                void buyStall({ data: { id: profile.id } })
                  .then((r) => {
                    toast(`买下了，付 ${formatFen(r.paid)}`);
                    return router.invalidate();
                  })
                  .catch((err) => toast(err instanceof Error ? err.message : "没买成"))
                  .finally(() => setTradeBusy(false));
              }}
            >
              买下这具 · {formatFen(profile.listedFen)}
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">男人怎么评这具便器</h2>
        {canReview && (
          <div className="mt-3">
            <ReviewForm
              profileId={profile.id}
              name={profile.name}
              onDone={() => {
                void listStallReviews({ data: { profileId: profile.id } }).then(setReviews);
              }}
            />
          </div>
        )}
        {reviews && reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted">还没人评。用完公厕才能打分。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews?.map((r) => (
              <li key={r.id} className="rounded-2xl bg-surface p-4 shadow-border">
                <Stars value={r.score} size="sm" />
                {r.comment ? <p className="mt-2 text-sm leading-relaxed">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <InquirySheet profile={profile} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
