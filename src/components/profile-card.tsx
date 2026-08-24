import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { Profile } from "@/lib/profiles";
import { useFavorites } from "@/lib/favorites";
import { formatFen, formatRating } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ProfileCard({ profile: p }: { profile: Profile }) {
  const ids = useFavorites((s) => s.ids);
  const toggle = useFavorites((s) => s.toggle);
  const saved = ids.includes(p.id);

  return (
    <article className="relative overflow-hidden rounded-2xl bg-surface shadow-border">
      <Link to="/p/$id" params={{ id: p.id }} className="block">
        <div className="aspect-[3/4] overflow-hidden">
          <img src={p.image} alt="" className="size-full object-cover" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/70 to-transparent p-3 pt-16">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">
                {p.name}
                <span className="ml-1.5 font-sans text-sm font-normal text-fg/70">{p.age}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-fg/65">
                {p.persona ? `${p.persona} · ` : ""}
                {p.area} · {p.etaMin}分到 · {formatRating(p.ratingAvg, p.ratingCount)}
              </p>
            </div>
            <span className="shrink-0 tabular-nums text-sm">{formatFen(p.hourFen)}/次</span>
          </div>
        </div>
        {p.online && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-bg/70 px-2 py-1 text-xs text-live">
            可点单
          </span>
        )}
        {p.unowned && (
          <span className="absolute left-2.5 top-10 rounded-full bg-bg/70 px-2 py-1 text-xs text-muted">
            无主
          </span>
        )}
        {p.listedFen ? (
          <span className="absolute bottom-14 right-2.5 rounded-full bg-bg/70 px-2 py-1 text-xs">
            卖 {formatFen(p.listedFen)}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        aria-label={saved ? "取消占坑" : "占坑"}
        onClick={() => toggle(p.id)}
        className={cn(
          "absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-bg/55 text-fg",
          saved && "text-primary",
        )}
      >
        <Heart className={cn("size-4", saved && "fill-primary")} />
      </button>
    </article>
  );
}
