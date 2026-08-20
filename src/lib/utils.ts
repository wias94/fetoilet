import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFen(fen: number) {
  const yuan = fen / 100;
  if (yuan >= 10000) return `¥${yuan / 10000}万`;
  return yuan % 1 === 0 ? `¥${yuan}` : `¥${yuan.toFixed(1)}`;
}

export function greetingForHour(hour: number) {
  if (hour < 5) return "肉便器还开着";
  if (hour < 12) return "白天也能方便";
  if (hour < 18) return "黄昏了，就近找坑";
  return "晚上了，去方便";
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
