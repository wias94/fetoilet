import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, DoorOpen, Inbox, UserRound } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { AuthSlot } from "@/components/auth-slot";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="min-w-0">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <HeaderLink to="/" label="找厕" />
            <HeaderLink to="/inbox" label="已订" />
            <HeaderLink to="/desk" label="登厕" />
            <HeaderLink to="/me" label="我的" />
          </nav>
          <AuthSlot />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-5 md:pb-12">{children}</div>
      <MobileTabBar />
    </div>
  );
}

function HeaderLink({
  to,
  label,
}: {
  to: "/" | "/inbox" | "/me" | "/desk";
  label: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "rounded-full px-3.5 py-2 text-sm transition-colors",
        active ? "bg-fg text-bg" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/" as const, label: "找厕", icon: Compass, active: pathname === "/" },
    { to: "/inbox" as const, label: "已订", icon: Inbox, active: pathname.startsWith("/inbox") },
    { to: "/desk" as const, label: "登厕", icon: DoorOpen, active: pathname.startsWith("/desk") },
    { to: "/me" as const, label: "我的", icon: UserRound, active: pathname.startsWith("/me") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  tab.active ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={tab.active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
