import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Megaphone, LayoutGrid, Package, Receipt, Users } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { AuthSlot } from "@/components/auth-slot";
import { cn } from "@/lib/utils";

type AdminPath = "/admin" | "/admin/users" | "/admin/stalls" | "/admin/orders" | "/admin/push";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/admin" className="min-w-0">
            <Wordmark side="管事台" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <HeaderLink to="/admin" label="总览" exact />
            <HeaderLink to="/admin/users" label="用户" />
            <HeaderLink to="/admin/stalls" label="货" />
            <HeaderLink to="/admin/orders" label="单" />
            <HeaderLink to="/admin/push" label="推流" />
          </nav>
          <AuthSlot to="/admin" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 md:pb-12">{children}</div>
      <MobileTabBar />
    </div>
  );
}

function HeaderLink({
  to,
  label,
  exact,
}: {
  to: AdminPath;
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
  const tabs: { to: AdminPath; label: string; icon: typeof Users; active: boolean }[] = [
    { to: "/admin", label: "总览", icon: LayoutGrid, active: pathname === "/admin" },
    { to: "/admin/users", label: "用户", icon: Users, active: pathname.startsWith("/admin/users") },
    { to: "/admin/stalls", label: "货", icon: Package, active: pathname.startsWith("/admin/stalls") },
    { to: "/admin/orders", label: "单", icon: Receipt, active: pathname.startsWith("/admin/orders") },
    { to: "/admin/push", label: "推流", icon: Megaphone, active: pathname.startsWith("/admin/push") },
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
