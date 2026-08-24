import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createPost, deletePost, listFeed, type FeedPost } from "@/lib/feed";

function ago(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.round(h / 24)}天前`;
}

export function FeedList({ compose }: { compose?: boolean }) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const list = await listFeed();
    setPosts(list);
  }

  useEffect(() => {
    let cancelled = false;
    void listFeed()
      .then((list) => {
        if (!cancelled) setPosts(list);
      })
      .catch((err) => {
        if (!cancelled) toast(err instanceof Error ? err.message : "加载失败");
      });
    const timer = window.setInterval(() => {
      void listFeed()
        .then((list) => {
          if (!cancelled) setPosts(list);
        })
        .catch(() => undefined);
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function publish() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await createPost({ data: { body: text } });
      setBody("");
      await load();
      toast("发出去了");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没发出去");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deletePost({ data: { id } });
      setPosts((cur) => cur?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "没删掉");
    }
  }

  return (
    <div className="space-y-3">
      {compose && (
        <div className="rounded-2xl bg-surface p-4 shadow-border">
          <Textarea
            value={body}
            maxLength={280}
            placeholder="发一条动态，男性会看到"
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-subtle">{body.length}/280</span>
            <Button size="sm" disabled={busy || !body.trim()} onClick={() => void publish()}>
              发布
            </Button>
          </div>
        </div>
      )}
      {posts === null && <div className="h-32 animate-pulse rounded-2xl bg-fg/10" />}
      {posts?.length === 0 && <p className="py-12 text-center text-sm text-muted">还没有动态</p>}
      {posts?.map((p) => (
        <article key={p.id} className="rounded-2xl bg-surface p-4 shadow-border">
          <div className="flex gap-3">
            <Link to="/p/$id" params={{ id: p.stallId }} className="shrink-0">
              <img src={p.stallImage} alt="" className="size-12 rounded-xl object-cover" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link to="/p/$id" params={{ id: p.stallId }} className="truncate font-medium">
                  {p.stallName}
                </Link>
                <span className="shrink-0 text-xs text-subtle">{ago(p.createdAt)}</span>
              </div>
              <p className="text-xs text-muted">
                {p.area}
                {p.online ? " · 在线" : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
              {p.mine && (
                <button
                  type="button"
                  className="mt-2 text-xs text-subtle hover:text-muted"
                  onClick={() => void remove(p.id)}
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
