import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : "/",
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 text-fg">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight">夜巷</span>
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">登录后再方便</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          找附近的肉厕不用账号。要叫它走过来，或要把自己登记成厕，再登。
        </p>
        <div className="mt-8 space-y-3">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void signIn(p.providerId, { callbackURL: redirect ?? "/" })}
              >
                使用 {p.label} 继续
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">登录已关闭</p>
          )}
        </div>
        <Link to="/" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          先去找厕
        </Link>
      </div>
    </main>
  );
}
