import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AuthSlot, SignOutButton } from "@/components/auth-slot";
import { ProfileCard } from "@/components/profile-card";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFavorites } from "@/lib/favorites";
import { getProfile, type Profile } from "@/lib/profiles";
import { listPublicStalls } from "@/lib/stalls";

export const Route = createFileRoute("/me")({
  loader: () => listPublicStalls(),
  component: MePage,
});

function MePage() {
  const stalls = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const ids = useFavorites((s) => s.ids);
  const saved = ids.map((id) => getProfile(id, stalls)).filter((p): p is Profile => p != null);

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </AppShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/me" }} />;
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold tracking-tight">我的</h1>

      <div className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex items-center gap-3">
          <AuthSlot />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName ?? "客人"}</p>
            <p className="truncate text-sm text-muted">{user.primaryEmail}</p>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">占着的坑</h2>
        {saved.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">还没占。右上角点一下，先锁这具便器。</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {saved.map((p) => (
              <ProfileCard key={p.id} profile={p} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <Button variant="secondary" asChild>
          <Link to="/inbox">我订的便器</Link>
        </Button>
        {user && <SignOutButton />}
        <Link to="/work" className="text-center text-sm text-subtle hover:text-muted">
          我是肉便器，进便器端
        </Link>
      </div>
    </AppShell>
  );
}
