import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StallEditor } from "@/components/stall-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setStallListed } from "@/lib/economy";
import { getOwnedStallLogin, resetOwnedStallLogin } from "@/lib/stall-account";

export const Route = createFileRoute("/owned/$id")({ component: OwnedStallPage });

function OwnedStallPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [yuan, setYuan] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`stall-login:${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { email?: string; password?: string };
      if (parsed.email && parsed.password) setIssued({ email: parsed.email, password: parsed.password });
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void getOwnedStallLogin({ data: { id } })
      .then((row) => {
        if (!cancelled) setLoginEmail(row.email);
      })
      .catch(() => {
        if (!cancelled) setLoginEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-fg/10" />
      </AppShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: `/owned/${id}` }} />;
  }

  return (
    <AppShell>
      {issued && (
        <div className="mb-8 rounded-2xl bg-surface p-5 shadow-border">
          <p className="text-sm text-muted">肉厕端登录</p>
          <h2 className="mt-1 font-display text-xl font-semibold">把这组交给她</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            登录权在你手里。忘了就在下面重发一组，旧的立刻作废。
          </p>
          <p className="mt-4 text-sm text-muted">邮箱</p>
          <p className="mt-1 font-display text-lg font-semibold break-all">{issued.email}</p>
          <p className="mt-3 text-sm text-muted">密码</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-widest">{issued.password}</p>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(`${issued.email}\n${issued.password}`).then(
                  () => toast("已复制邮箱和密码"),
                  () => toast(`${issued.email} ${issued.password}`),
                );
              }}
            >
              复制
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void resetOwnedStallLogin({ data: { id } })
                  .then((row) => {
                    setIssued(row);
                    sessionStorage.setItem(`stall-login:${id}`, JSON.stringify(row));
                    toast("已换成新密码");
                  })
                  .catch((err) => toast(err instanceof Error ? err.message : "没发成"))
                  .finally(() => setBusy(false));
              }}
            >
              再发一组
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                sessionStorage.removeItem(`stall-login:${id}`);
                setIssued(null);
              }}
            >
              我已抄走
            </Button>
          </div>
        </div>
      )}
      {loginEmail && !issued && (
        <div className="mb-8 rounded-2xl bg-surface p-5 shadow-border">
          <p className="text-sm text-muted">肉厕端登录</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            这具是你的财产。登录号由你保管，忘了就重发，旧密码立刻作废。
          </p>
          <p className="mt-4 text-sm text-muted">邮箱</p>
          <p className="mt-1 font-display text-lg font-semibold break-all">{loginEmail}</p>
          <Button
            className="mt-4"
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void resetOwnedStallLogin({ data: { id } })
                .then((row) => {
                  setIssued(row);
                  sessionStorage.setItem(`stall-login:${id}`, JSON.stringify(row));
                  toast("已重发，把新密码交给她");
                })
                .catch((err) => toast(err instanceof Error ? err.message : "没发成"))
                .finally(() => setBusy(false));
            }}
          >
            重发登录密码
          </Button>
        </div>
      )}
      <div className="mb-8 rounded-2xl bg-surface p-5 shadow-border">
        <p className="text-sm text-muted">挂牌转给别的男人</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">填价格就上架。别人付钱，这具就换主。</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="number"
            min={0}
            placeholder="转让价 C$"
            value={yuan}
            onChange={(e) => setYuan(e.target.value)}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              const n = Math.round(Number(yuan) * 100);
              if (!Number.isFinite(n) || n < 1) {
                toast("先填价格");
                return;
              }
              setBusy(true);
              void setStallListed({ data: { id, fen: n } })
                .then(() => toast("已挂牌"))
                .catch((err) => toast(err instanceof Error ? err.message : "没挂成"))
                .finally(() => setBusy(false));
            }}
          >
            挂牌
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void setStallListed({ data: { id, fen: null } })
                .then(() => toast("撤了"))
                .catch((err) => toast(err instanceof Error ? err.message : "没撤成"))
                .finally(() => setBusy(false));
            }}
          >
            撤牌
          </Button>
        </div>
      </div>
      <StallEditor asOwner stallId={id} />
    </AppShell>
  );
}
