import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : "/",
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const stallSide = (redirect ?? "/").startsWith("/work");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function oauth(providerId: string) {
    try {
      await signIn(providerId, {
        callbackURL: redirect ?? "/",
        errorCallbackURL: "/login",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "没登上";
      toast(
        message.includes("Pop-up") || message.includes("popup")
          ? "弹窗被拦了。允许弹出窗口，或用下面邮箱登录"
          : message,
      );
    }
  }

  async function withEmail(mode: "in" | "up") {
    if (!email.trim() || password.length < 8) {
      toast("邮箱和密码（至少 8 位）");
      return;
    }
    setBusy(true);
    try {
      const fn =
        mode === "up"
          ? authClient.signUp.email({ email: email.trim(), password, name: stallSide ? "肉便器" : "客人" })
          : authClient.signIn.email({ email: email.trim(), password });
      const { error } = await fn;
      if (error) {
        toast(error.message ?? "没登上");
        return;
      }
      window.location.href = redirect ?? "/";
    } catch (err) {
      toast(err instanceof Error ? err.message : "没登上");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to={stallSide ? "/work" : "/"} className="flex items-center gap-2 text-fg">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight">
            夜巷{stallSide ? " · 便器端" : ""}
          </span>
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">
          {stallSide ? "登录进便器端" : "登录后再方便"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {stallSide
            ? "接单、开坑、改坑位要账号。满 18 岁才能把自己登记成肉便器。"
            : "找附近的肉便器不用账号。要叫它走过来当马桶，再登。"}
        </p>
        <div className="mt-8 space-y-3">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void oauth(p.providerId)}
              >
                使用 {p.label} 继续
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">登录已关闭</p>
          )}
        </div>
        <p className="mt-3 text-xs text-subtle">Google 会弹窗。被拦了就用邮箱。</p>

        <div className="mt-8 space-y-3">
          <Input
            type="email"
            autoComplete="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="密码，至少 8 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" type="button" disabled={busy} onClick={() => void withEmail("in")}>
            邮箱登录
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void withEmail("up")}
          >
            注册邮箱
          </Button>
        </div>
        <Link
          to={stallSide ? "/work" : "/"}
          className="mt-6 inline-block text-sm text-muted hover:text-fg"
        >
          {stallSide ? "回便器端" : "先去找坑"}
        </Link>
      </div>
    </main>
  );
}
