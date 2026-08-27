import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AuthSlot, SignOutButton } from "@/components/auth-slot";
import { ProfileCard } from "@/components/profile-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFavorites } from "@/lib/favorites";
import { getMyWallet, listMyLedger } from "@/lib/economy";
import {
  answerClaim,
  claimByStallToken,
  getMyOwnerToken,
  listClaimRequests,
  type ClaimRow,
} from "@/lib/owners";
import { getProfile, type Profile } from "@/lib/profiles";
import { listOwnedStalls, listPublicStalls } from "@/lib/stalls";
import { getMyMaleAccount, saveMyMaleAccount } from "@/lib/male-account";
import {
  actOwnerInquiry,
  listOwnerInquiries,
  stallStatusLabel,
  type Inquiry,
} from "@/lib/inquiries";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/me")({
  loader: () => listPublicStalls(),
  component: MePage,
});

function MePage() {
  const stalls = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const ids = useFavorites((s) => s.ids);
  const saved = ids.map((id) => getProfile(id, stalls)).filter((p): p is Profile => p != null);
  const [token, setToken] = useState<string | null>(null);
  const [owned, setOwned] = useState<Profile[] | null>(null);
  const [wallet, setWallet] = useState<number | null>(null);
  const [ledger, setLedger] = useState<{ id: string; fen: number; note: string }[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [orders, setOrders] = useState<Inquiry[]>([]);
  const [claimToken, setClaimToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [account, setAccount] = useState<{ name: string; age: number | null } | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [ageDraft, setAgeDraft] = useState("");

  async function refresh() {
    const [tok, list, w, c, o, led, acc] = await Promise.all([
      getMyOwnerToken(),
      listOwnedStalls(),
      getMyWallet(),
      listClaimRequests(),
      listOwnerInquiries(),
      listMyLedger(),
      getMyMaleAccount().catch(() => null),
    ]);
    setToken(tok.token);
    setOwned(list);
    setWallet(w.fen);
    setClaims(c);
    setOrders(o);
    setLedger(led.map((r) => ({ id: r.id, fen: r.fen, note: r.note })));
    if (acc) {
      setAccount(acc);
      setNameDraft(acc.name);
      setAgeDraft(acc.age != null ? String(acc.age) : "");
    }
  }

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    refresh()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setOwned([]);
          setWallet(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

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
      <h1 className="font-display text-3xl font-semibold tracking-tight">账户</h1>

      <div className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex items-center gap-3">
          <AuthSlot />
          <div className="min-w-0">
            <p className="truncate font-medium">{account?.name || user.displayName || "客人"}</p>
            <p className="truncate text-sm text-muted">
              {account?.age ? `${account.age} 岁 · ` : ""}
              {user.primaryEmail}
            </p>
          </div>
        </div>
        <p className="mt-4 font-display text-2xl font-semibold tabular-nums">
          {wallet == null ? "……" : formatFen(wallet)}
        </p>
        <p className="mt-1 text-sm text-muted">名下肉厕被使用后，收益结算至此。无主肉厕被使用后收益为零。</p>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="姓名"
            maxLength={16}
          />
          <Input
            value={ageDraft}
            onChange={(e) => setAgeDraft(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="年龄"
            inputMode="numeric"
          />
          <Button
            type="button"
            className="col-span-2"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => {
              const age = Number(ageDraft);
              setBusy("account");
              void saveMyMaleAccount({ data: { name: nameDraft, age } })
                .then((row) => {
                  setAccount(row);
                  toast("资料已更新");
                })
                .catch((err) => toast(err instanceof Error ? err.message : "没存成"))
                .finally(() => setBusy(null));
            }}
          >
            保存姓名和年龄
          </Button>
        </div>
        {ledger.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
            {ledger.slice(0, 6).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted">{row.note}</span>
                <span className="shrink-0 tabular-nums">{row.fen > 0 ? "+" : ""}{formatFen(row.fen)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <p className="text-sm text-muted">所属权口令</p>
        <p className="mt-2 font-display text-2xl font-semibold tracking-widest">{token ?? "……"}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">交付肉厕选填。一经填写，该肉厕即归入您名下，使用收益计入本账户。</p>
        <Button
          className="mt-4"
          variant="secondary"
          type="button"
          disabled={!token}
          onClick={() => {
            if (!token) return;
            void navigator.clipboard.writeText(token).then(
              () => toast("口令复制了"),
              () => toast(token),
            );
          }}
        >
          复制口令
        </Button>
      </section>

      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-border">
        <p className="text-sm text-muted">以便器口令收编无主肉厕</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          无主肉厕出示 TC- 口令后，填写即可完成收编，该肉厕归入您名下。
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={claimToken}
            onChange={(e) => setClaimToken(e.target.value)}
            placeholder="TC-********"
            autoComplete="off"
          />
          <Button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBusy("claim");
              void claimByStallToken({ data: { token: claimToken } })
                .then((row) => {
                  toast(`收编了 ${row.name}`);
                  setClaimToken("");
                  return refresh();
                })
                .catch((err) => toast(err instanceof Error ? err.message : "没收成"))
                .finally(() => setBusy(null));
            }}
          >
            收编
          </Button>
        </div>
      </section>

      {claims.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted">求你收编</h2>
          <ul className="mt-3 space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-border">
                <span className="min-w-0 truncate font-medium">{c.stallName}</span>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy(c.id);
                      void answerClaim({ data: { id: c.id, accept: true } })
                        .then(() => {
                          toast("收编了");
                          return refresh();
                        })
                        .catch((err) => toast(err instanceof Error ? err.message : "没成"))
                        .finally(() => setBusy(null));
                    }}
                  >
                    收下
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy(c.id);
                      void answerClaim({ data: { id: c.id, accept: false } })
                        .then(() => refresh())
                        .finally(() => setBusy(null));
                    }}
                  >
                    不要
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted">名下的肉厕</h2>
          <Button size="sm" asChild>
            <Link to="/add">登记身边的女性为肉厕</Link>
          </Button>
        </div>
        {owned && owned.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">名下暂无肉厕。可将妻子、母亲、已满十八岁的女儿、女友登记挂牌，或以便器口令收编无主肉厕。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {owned?.map((p) => (
              <li key={p.id}>
                <Link
                  to="/owned/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-border"
                >
                  <span className="min-w-0 truncate font-medium">
                    {p.name}
                    {p.relation ? <span className="ml-2 text-sm font-normal text-muted">{p.relation}</span> : null}
                  </span>
                  <span className="text-sm text-muted">
                    {p.listedFen ? `卖 ${formatFen(p.listedFen)}` : p.online ? "可灌" : "收着"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orders.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted">名下的单</h2>
          <ul className="mt-3 space-y-2">
            {orders.map((row) => (
              <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-border">
                <p className="font-medium">{row.profileName}</p>
                <p className="mt-1 text-sm text-muted">{row.slot}</p>
                <p className="mt-1 text-sm text-subtle">{stallStatusLabel(row.status)}</p>
                {row.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        setBusy(row.id);
                        void actOwnerInquiry({ data: { id: row.id, action: "accept" } })
                          .then((next) => setOrders((cur) => cur.map((r) => (r.id === next.id ? next : r))))
                          .catch((err) => toast(err instanceof Error ? err.message : "没成"))
                          .finally(() => setBusy(null));
                      }}
                    >
                      把坑送过去
                    </Button>
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        setBusy(row.id);
                        void actOwnerInquiry({ data: { id: row.id, action: "reject" } })
                          .then((next) => setOrders((cur) => cur.map((r) => (r.id === next.id ? next : r))))
                          .finally(() => setBusy(null));
                      }}
                    >
                      不给
                    </Button>
                  </div>
                )}
                {row.status === "accepted" && (
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy(row.id);
                      void actOwnerInquiry({ data: { id: row.id, action: "arrive" } })
                        .then((next) => setOrders((cur) => cur.map((r) => (r.id === next.id ? next : r))))
                        .finally(() => setBusy(null));
                    }}
                  >
                    肉厕已到位
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <SignOutButton />
        <Link to="/work" className="text-center text-sm text-subtle hover:text-muted">
          我是肉厕，进肉厕端
        </Link>
      </div>
    </AppShell>
  );
}
