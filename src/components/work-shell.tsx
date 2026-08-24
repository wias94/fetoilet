import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, ClipboardList, MessageCircle, Radio, UserRound } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { AuthSlot } from "@/components/auth-slot";
import { cn } from "@/lib/utils";

type WorkPath = "/work" | "/work/feed" | "/work/mail" | "/work/stats" | "/work/stall" | "/work/me";

export function WorkShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/work" className="min-w-0">
            <Wordmark side="肉厕端" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <HeaderLink to="/work" label="接单" exact />
            <HeaderLink to="/work/feed" label="动态" />
            <HeaderLink to="/work/mail" label="私信" />
            <HeaderLink to="/work/stats" label="数据" />
            <HeaderLink to="/work/me" label="本厕" />
          </nav>
          <AuthSlot to="/work/me" />
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
  exact,
}: {
  to: WorkPath;
  label: string;
  exact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname.startsWith(to);
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
  const tabs: { to: WorkPath; label: string; icon: typeof ClipboardList; active: boolean }[] = [
    {
      to: "/work",
      label: "接单",
      icon: ClipboardList,
      active: pathname === "/work",
    },
    {
      to: "/work/feed",
      label: "动态",
      icon: Radio,
      active: pathname.startsWith("/work/feed"),
    },
    {
      to: "/work/mail",
      label: "私信",
      icon: MessageCircle,
      active: pathname.startsWith("/work/mail"),
    },
    {
      to: "/work/stats",
      label: "数据",
      icon: BarChart3,
      active: pathname.startsWith("/work/stats"),
    },
    {
      to: "/work/me",
      label: "本厕",
      icon: UserRound,
      active: pathname.startsWith("/work/me"),
    },
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
