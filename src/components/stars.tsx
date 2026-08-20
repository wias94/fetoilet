import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({
  value,
  onPick,
  size = "md",
}: {
  value: number;
  onPick?: (n: number) => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-3.5" : "size-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={!onPick}
            onClick={onPick ? () => onPick(n) : undefined}
            className={cn("grid place-items-center disabled:cursor-default", onPick ? "size-8" : "p-0")}
            aria-label={`${n}分`}
          >
            <Star className={cn(dim, filled ? "fill-fg text-fg" : "text-subtle")} />
          </button>
        );
      })}
    </div>
  );
}
