/** Live process.env — Vite/Nitro must not inline these at build. */
export function runtimeEnv(name: string) {
  const env =
    typeof process !== "undefined" && process.env ? process.env : undefined;
  const value = env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

