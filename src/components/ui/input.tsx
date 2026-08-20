import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl bg-surface px-3.5 text-base text-fg shadow-border outline-none",
        "placeholder:text-subtle",
        "focus-visible:shadow-border-hover",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl bg-surface px-3.5 py-3 text-base text-fg shadow-border outline-none",
        "placeholder:text-subtle",
        "focus-visible:shadow-border-hover",
        className,
      )}
      {...props}
    />
  );
}
