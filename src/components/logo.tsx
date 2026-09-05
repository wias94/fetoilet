import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      className={cn("mark size-8 object-contain object-bottom", className)}
    />
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
