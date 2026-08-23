import { Link, useRouterState } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot({ to = "/me" }: { to?: "/me" | "/work/me" | "/admin" }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isPending) {
    return <div className="size-9 shrink-0 animate-pulse rounded-full bg-fg/10" />;
  }
  if (!user) {
    return (
      <Link
        to="/login"
        search={{
          redirect: pathname.startsWith("/work")
            ? "/work"
            : pathname.startsWith("/admin")
              ? "/admin"
              : pathname,
        }}
        className="inline-flex h-9 items-center rounded-full bg-fg px-3.5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        登录
      </Link>
    );
  }
  const label = user.displayName ?? user.primaryEmail ?? "我的";
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-9 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-medium text-primary-fg">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </Link>
  );
}

export function SignOutButton({ home = "/" }: { home?: string }) {
  return (
    <button
      type="button"
      onClick={() => void signOut(home)}
      className="h-11 rounded-xl px-4 text-sm font-medium text-muted shadow-border transition-transform duration-150 ease-out active:scale-[0.96]"
    >
      退出登录
    </button>
  );
}
