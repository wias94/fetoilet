import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StallEditor } from "@/components/stall-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setStallListed } from "@/lib/economy";

export const Route = createFileRoute("/owned/$id")({ component: OwnedStallPage });

function OwnedStallPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [yuan, setYuan] = useState("");
  const [busy, setBusy] = useState(false);

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
      <div className="mb-8 rounded-2xl bg-surface p-5 shadow-border">
        <p className="text-sm text-muted">挂牌转给别的男人</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">填价格就上架。别人付钱，这具就换主。</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="number"
            min={0}
            placeholder="转让价 ¥"
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
