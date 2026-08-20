import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { SLOTS, type Profile } from "@/lib/profiles";
import { placeInquiry } from "@/lib/inquiries";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatFen } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function InquirySheet({
  profile,
  open,
  onOpenChange,
}: {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string>(SLOTS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (isPending) return;
    if (!user) {
      onOpenChange(false);
      void navigate({ to: "/login", search: { redirect: `/p/${profile.id}` } });
      toast("方便前先登录");
      return;
    }
    setSubmitting(true);
    try {
      await placeInquiry({ data: { profileId: profile.id, slot, note } });
      onOpenChange(false);
      toast(`已占坑 ${profile.name}`);
      void navigate({ to: "/inbox" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "没发出去";
      if (message === "Unauthorized") {
        onOpenChange(false);
        void navigate({ to: "/login", search: { redirect: `/p/${profile.id}` } });
        toast("方便前先登录");
      } else {
        toast(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-bg/70" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-fg/15" />
          <Drawer.Title className="px-5 pb-1 pt-4 font-display text-xl font-semibold">
            占用这具肉便器 {profile.name}
          </Drawer.Title>
          <p className="px-5 text-sm text-muted">
            {formatFen(profile.hourFen)} / 冲 · 通宵 {formatFen(profile.nightFen)}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="text-sm font-medium">什么时候方便</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm",
                    slot === s ? "bg-primary text-primary-fg" : "bg-sunken text-fg",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-5 text-sm font-medium">备注</p>
            <Input
              className="mt-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="在哪泄：你家、酒店、车上、巷口"
              maxLength={80}
            />
          </div>
          <div className="border-t border-border px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <Button className="w-full" disabled={submitting} onClick={() => void submit()}>
              {submitting ? "在占…" : "占这坑"}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
