import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMessages, sendMessage, type ChatMessage, type Thread } from "@/lib/messages";
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
        const data = await listMessages({ data: { id } });
        if (cancelled) return;
        setThread(data.thread);
        setMessages(data.messages);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "加载失败");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8000);
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
      const msg = await sendMessage({ data: { id, text: next } });
      setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
      setText("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "没发出去";
      toast(message.startsWith("[") ? "没发出去" : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <Link to={backTo} className="inline-flex h-10 items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {thread?.peerName ?? "私信"}
      </h1>
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pb-24">
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
      <form
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md md:bottom-0"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="mx-auto flex max-w-5xl gap-2">
          <Input
            value={text}
            maxLength={2000}
            placeholder="写一句"
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? "在发…" : "发送"}
          </Button>
        </div>
      </form>
    </div>
  );
}
