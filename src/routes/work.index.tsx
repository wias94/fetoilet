import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { WorkShell } from "@/components/work-shell";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listStallInquiries, actStallInquiry, stallStatusLabel, type Inquiry } from "@/lib/inquiries";
import { getMyStall, setMyStallOnline, type MineStall } from "@/lib/stalls";
import { requestOwnership } from "@/lib/owners";
import { formatWhen } from "@/lib/utils";

export const Route = createFileRoute("/work/")({ component: WorkHome });

function WorkHome() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <WorkShell>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-fg/10" />
      </WorkShell>
    );
  }

  if (!user) return <WorkLanding />;
  return <WorkBoard />;
}

function WorkLanding() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <img src="/profiles/join-poster.jpg" alt="" className="absolute inset-0 size-full object-cover object-top" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/30" />
      <div className="relative z-10 flex min-h-dvh flex-col justify-end px-6 pb-10 pt-16 sm:px-10">
        <div className="mx-auto w-full max-w-lg">
          <div className="flex items-center gap-2 text-fg/70">
            <LogoMark className="size-8" />
            <span className="text-sm tracking-widest">XIANGCE · TOILET</span>
          </div>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            肉厕端
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-fg/70">
            供肉厕及所属人办理挂牌、接单与履约。开启后即作为移动肉厕接受点单灌注。无主肉厕被使用后收益为零；可将便器口令交付客户办理收编。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" className="h-12 rounded-full px-6" asChild>
              <Link to="/login" search={{ redirect: "/work" }}>
                登录并办理挂牌
              </Link>
            </Button>
            <Link to="/" className="text-sm text-fg/70 underline-offset-4 hover:text-fg hover:underline">
              我是客户，前往交易所
            </Link>
          </div>
          <p className="mt-4 text-sm text-fg/45">本平台为虚构演示，挂牌须满十八周岁</p>
        </div>
      </div>
    </main>
  );
}

function WorkBoard() {
  const [stall, setStall] = useState<MineStall | null | undefined>(undefined);
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [mine, list] = await Promise.all([getMyStall(), listStallInquiries()]);
        if (cancelled) return;
        setStall(mine);
        setRows(list);
      } catch {
        if (cancelled) return;
        setStall(null);
        setRows([]);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function toggleOnline() {
    if (!stall) return;
    setBusy(true);
    try {
      const next = await setMyStallOnline({ data: { online: !stall.online } });
      setStall({ ...stall, ...next });
      toast(next.online ? "已开坑，男人能拿你泄" : "已收坑，货架上先藏着这具便器");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没改成");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "accept" | "reject" | "arrive") {
    setActing(`${id}:${action}`);
    try {
      const next = await actStallInquiry({ data: { id, action } });
      setRows((cur) => cur?.map((row) => (row.id === id ? next : row)) ?? null);
      toast(
        action === "accept" ? "已接，过去给人泄" : action === "reject" ? "已拒" : "已到，等人来用",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "没改成");
    } finally {
      setActing(null);
    }
  }

  if (stall === undefined) {
    return (
      <WorkShell>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-36 animate-pulse rounded-2xl bg-fg/10" />
      </WorkShell>
    );
  }

  if (!stall) {
    return (
      <WorkShell>
        <p className="text-sm text-muted">便器端 · 等人来泄</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">还没把自己登记成便器</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          先占一个坑位。挂上之后，男人要拿你泄的单会堆在这里。
        </p>
        <Button className="mt-6" asChild>
          <Link to="/work/stall">去登记成肉便器</Link>
        </Button>
      </WorkShell>
    );
  }

  return (
    <WorkShell>
      <p className="text-sm text-muted">便器端 · 等人来泄</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{stall.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {stall.etaMin} 分钟到 · {stall.online ? "现在挂着" : "关着"}
      </p>

      <button
        type="button"
        onClick={() => void toggleOnline()}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-between rounded-2xl bg-surface px-5 py-4 text-left shadow-border disabled:opacity-50"
      >
        <div>
          <p className="font-display text-lg font-semibold">{stall.online ? "开着坑" : "收着坑"}</p>
          <p className="mt-0.5 text-sm text-muted">
            {stall.online ? "本厕已上架，客户可从附近点单灌注" : "本厕休息中，货架暂不展示"}
          </p>
        </div>
        <span className={stall.online ? "text-sm text-live" : "text-sm text-subtle"}>
          {stall.online ? "出车中" : "收车"}
        </span>
      </button>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">
          要拿你泄的男人
          {rows && rows.some((r) => r.status === "pending")
            ? ` · ${rows.filter((r) => r.status === "pending").length} 单待接`
            : ""}
        </h2>
        {rows && rows.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-surface px-5 py-10 text-center shadow-border">
            <p className="font-display text-lg">还没人叫</p>
            <p className="mt-1 text-sm text-muted">
              {stall.online ? "开着就等。有人要点这具便器，单会落在这儿。" : "先开坑，单才会来。"}
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows?.map((row) => (
              <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-border">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">客人要点这具便器</p>
                  <p className="text-xs text-subtle">{formatWhen(row.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">{row.slot}</p>
                {row.note ? <p className="mt-2 text-sm text-subtle">{row.note}</p> : null}
                <p
                  className={
                    row.status === "pending" || row.status === "accepted" || row.status === "arrived"
                      ? "mt-2 text-sm text-live"
                      : "mt-2 text-sm text-subtle"
                  }
                >
                  {stallStatusLabel(row.status)}
                </p>
                {row.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={acting !== null}
                      onClick={() => void act(row.id, "accept")}
                    >
                      接单
                    </Button>
                    <Button
                      className="flex-1"
                      variant="secondary"
                      disabled={acting !== null}
                      onClick={() => void act(row.id, "reject")}
                    >
                      不接
                    </Button>
                  </div>
                )}
                {row.status === "accepted" && (
                  <Button
                    className="mt-3 w-full"
                    disabled={acting !== null}
                    onClick={() => void act(row.id, "arrive")}
                  >
                    我到了
                  </Button>
                )}
                {row.status === "used" && stall && !stall.hasOwner && (
                  <Button
                    className="mt-3 w-full"
                    variant="secondary"
                    disabled={acting !== null}
                    onClick={() => {
                      setActing(`${row.id}:claim`);
                      void requestOwnership({ data: { inquiryId: row.id } })
                        .then((res) => toast(res.already ? "已经求过了，等他收" : "已求他收编这具"))
                        .catch((err) => toast(err instanceof Error ? err.message : "没求成"))
                        .finally(() => setActing(null));
                    }}
                  >
                    求这个男人收编这具
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkShell>
  );
}
