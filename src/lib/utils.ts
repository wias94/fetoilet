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
  if (hour < 5) return "深夜仍有在册肉厕可供点单";
  if (hour < 12) return "日间营业 · 在册肉厕可查";
  if (hour < 18) return "下午场 · 就近选用肉厕";
  return "夜间营业 · 请选用在册肉厕";
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatRating(avg: number, count: number) {
  if (count < 1) return "暂无评价";
  const shown = avg % 1 === 0 ? String(avg) : avg.toFixed(1);
  return `${shown} 分 · ${count}评`;
}
