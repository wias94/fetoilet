import { cn } from "@/lib/utils";

/** 巷口印：门楣两柱是巷，底洼是厕。 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 5.8h18v3.2h-3.2v10.4c0 2.2-1.4 4.2-5.8 5.9-4.4-1.7-5.8-3.7-5.8-5.9V9H7V5.8Z"
      />
      <ellipse cx="16" cy="23" rx="4.2" ry="2.1" className="fill-live" />
    </svg>
  );
}

export function Wordmark({
  className,
  side,
}: {
  className?: string;
  side?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2 text-fg", className)}>
      <LogoMark className="size-7" />
      <span className="font-display text-lg font-semibold tracking-tight">巷厕</span>
      {side ? <span className="text-xs tracking-widest text-muted">{side}</span> : null}
    </span>
  );
}
