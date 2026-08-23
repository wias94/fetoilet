import process from "node:process";

/** Live process.env — Vite/Nitro must not inline these at build. */
export function runtimeEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}
