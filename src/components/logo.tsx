import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <path
        d="M8 24c4-9 7.2-14.5 8.8-19.2 2.4 5.6 6.4 12 8.8 19.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="6.5" r="1.8" fill="currentColor" />
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
