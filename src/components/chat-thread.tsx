import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMessages, sendMessage } from "@/lib/mail-api";
import type { ChatMessage, Thread } from "@/lib/messages";
import { cn } from "@/lib/utils";

export function ChatThread({
  id,
  backTo,
  backLabel,
}: {
  id: string;
  backTo: "/mail" | "/work/mail";
  backLabel: string;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listMessages(id);
        if (cancelled) return;
        setThread(data.thread);
        setMessages(data.messages);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "加载失败");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const next = text.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      const msg = await sendMessage(id, next);
      setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
      setText("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "没发出去");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col">
      <Link to={backTo} className="inline-flex h-10 items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {thread?.peerName ?? "私信"}
      </h1>
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-muted">还没有话。下面输入发出去。</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                m.mine ? "bg-primary text-primary-fg" : "bg-surface shadow-border",
              )}
            >
              {m.body}
            </p>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="sticky bottom-0 z-20 -mx-4 mt-3 border-t border-border bg-bg px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={text}
            maxLength={2000}
            placeholder="写一句"
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button type="button" disabled={busy || !text.trim()} onClick={() => void send()}>
            {busy ? "在发…" : "发送"}
          </Button>
        </div>
      </div>
    </div>
  );
}
