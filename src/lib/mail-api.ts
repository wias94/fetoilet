import { getBearerToken } from "@/lib/auth/client";
import type { ChatMessage, Thread } from "@/lib/messages";

async function mailFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const token = getBearerToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`/api/mail/${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `没发出去（${res.status}）`);
  return json;
}

export function listThreads() {
  return mailFetch<{ threads: Thread[] }>("threads").then((r) => r.threads);
}

export function openThread(stallId: string) {
  return mailFetch<{ id: string }>("threads", {
    method: "POST",
    body: JSON.stringify({ stallId }),
  });
}

export function listMessages(id: string) {
  return mailFetch<{ thread: Thread; messages: ChatMessage[] }>(`t/${id}`);
}

export function sendMessage(id: string, text: string) {
  return mailFetch<ChatMessage>(`t/${id}`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
