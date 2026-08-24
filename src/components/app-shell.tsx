import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Inbox, MessageCircle, Radio, UserRound } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { AuthSlot } from "@/components/auth-slot";
import { RoleGate } from "@/components/role-gate";
import { cn } from "@/lib/utils";

export function AppShell({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <RoleGate side="male" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="min-w-0">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <HeaderLink to="/" label="选厕" />
            <HeaderLink to="/feed" label="动态" />
            <HeaderLink to="/inbox" label="订单" />
            <HeaderLink to="/mail" label="私信" />
            <HeaderLink to="/me" label="账户" />
          </nav>
          <AuthSlot />
        </div>
      </header>
      <div className={cn("mx-auto w-full max-w-5xl px-4 pt-5", bare ? "pb-3" : "pb-24 md:pb-12")}>
        {children}
      </div>
      {!bare && <MobileTabBar />}
    </div>
  );
}

function HeaderLink({ to, label }: { to: "/" | "/feed" | "/inbox" | "/mail" | "/me"; label: string }) {
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
    { to: "/" as const, label: "选厕", icon: Compass, active: pathname === "/" },
    { to: "/feed" as const, label: "动态", icon: Radio, active: pathname.startsWith("/feed") },
    { to: "/inbox" as const, label: "订单", icon: Inbox, active: pathname.startsWith("/inbox") },
    { to: "/mail" as const, label: "私信", icon: MessageCircle, active: pathname.startsWith("/mail") },
    { to: "/me" as const, label: "账户", icon: UserRound, active: pathname.startsWith("/me") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
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
