import { useState } from "react";
import { toast } from "sonner";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertReview } from "@/lib/reviews";

export function ReviewForm({
  profileId,
  name,
  onDone,
}: {
  profileId: string;
  name: string;
  onDone?: () => void;
}) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await upsertReview({ data: { profileId, score, comment } });
      toast(`已给 ${name} 打分`);
      onDone?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "没评成");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-sunken p-3">
      <p className="text-sm">请为本肉厕的使用体验评分</p>
      <div className="mt-2">
        <Stars value={score} onPick={setScore} />
      </div>
      <Input
        className="mt-2"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="可选：松不松、准不准、好不好骂着冲"
        maxLength={120}
      />
      <Button className="mt-3 w-full" size="sm" disabled={busy} onClick={() => void submit()}>
        {busy ? "在评…" : "提交评价"}
      </Button>
    </div>
  );
}
