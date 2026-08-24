import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { resetEmailPassword } from "@/lib/auth/reset-password";
import { resolveLoginEmail, ADMIN_EMAIL } from "@/lib/auth/login-email";
import { ensureAdminReady } from "@/lib/auth/ensure-admin";
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

function authMessage(raw: string) {
  const text = raw.toLowerCase();
  if (text.includes("invalid email or password")) return "密码不对。忘了就点下面重设密码";
  if (text.includes("already exists")) return "这个邮箱已经注册过了，点邮箱登录。忘了密码就重设";
  if (text.includes("invalid origin")) return "登录环境不对，从肉厕端再进一次";
  return raw;
}

function Login() {
  const { redirect } = Route.useSearch();
  const stallSide = (redirect ?? "/").startsWith("/work");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureAdminReady().catch(() => undefined);
  }, []);

  function cleanEmail() {
    return resolveLoginEmail(email);
  }

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

  async function withEmail(mode: "in" | "up" | "reset") {
    const mail = cleanEmail();
    if (!mail || password.length < 8) {
      toast("邮箱和密码（至少 8 位）");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        await resetEmailPassword({ data: { email: mail, password } });
        const { error } = await authClient.signIn.email({ email: mail, password });
        if (error) {
          toast(authMessage(error.message ?? "重设了，再点一次邮箱登录"));
          return;
        }
        window.location.href = mail === ADMIN_EMAIL ? "/admin" : (redirect ?? "/");
        return;
      }
      if (mode === "up" && mail === ADMIN_EMAIL) {
        toast("管理号请直接登录");
        return;
      }
      const fn =
        mode === "up"
          ? authClient.signUp.email({
              email: mail,
              password,
              name: stallSide ? "肉厕" : "客户",
            })
          : authClient.signIn.email({ email: mail, password });
      const { error } = await fn;
      if (error) {
        toast(authMessage(error.message ?? "没登上"));
        return;
      }
      window.location.href = mail === ADMIN_EMAIL ? "/admin" : (redirect ?? "/");
    } catch (err) {
      toast(err instanceof Error ? authMessage(err.message) : "没登上");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <img
        src="/profiles/join-poster.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/25" />
      <div className="relative z-10 grid min-h-dvh place-items-end px-6 py-12 sm:place-items-center">
        <div className="w-full max-w-sm rounded-2xl bg-bg/80 p-5 shadow-border backdrop-blur-md sm:p-6">
          <Link to={stallSide ? "/work" : "/"} className="flex items-center gap-2 text-fg">
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight">
              巷厕{stallSide ? " · 肉厕端" : ""}
            </span>
          </Link>
          <p className="mt-4 text-xs tracking-widest text-subtle">NEW LISTINGS · 入住</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            {stallSide ? "登录肉厕端" : "登录客户端"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {stallSide
              ? "肉厕端用于将身体登记为公共肉厕、办理挂牌与接单。一个邮箱只能作为肉厕或客户之一。仅接受已满十八周岁。"
              : "客户登录后方可查阅在册肉厕并提交点单。一个邮箱只能作为客户或肉厕之一。"}
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
              type="text"
              autoComplete="username"
              placeholder="邮箱，或 admin"
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
            <button
              type="button"
              disabled={busy}
              onClick={() => void withEmail("reset")}
              className="w-full text-center text-sm text-subtle hover:text-muted"
            >
              忘记密码，用上面的邮箱设新的
            </button>
          </div>
          <Link
            to={stallSide ? "/work" : "/"}
            className="mt-6 inline-block text-sm text-muted hover:text-fg"
          >
            {stallSide ? "返回肉厕端" : "返回交易所"}
          </Link>
        </div>
      </div>
    </main>
  );
}
