import { useEffect, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/session", { credentials: "include" })
      .then((res) => {
        if (!cancelled) setOk(res.ok);
      })
      .catch(() => {
        if (!cancelled) setOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "账号或密码不对");
        return;
      }
      setOk(true);
    } catch {
      setError("没登上");
    } finally {
      setBusy(false);
    }
  }

  if (ok === null) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-fg/10" />
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
        <form
          className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 shadow-border"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm text-muted">管理台</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">登录</h1>
          <Input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
          />
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
          />
          {error && <p className="text-sm text-muted">{error}</p>}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "在登…" : "进入管理台"}
          </Button>
        </form>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
