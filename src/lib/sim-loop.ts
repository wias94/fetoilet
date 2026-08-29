const g = globalThis as typeof globalThis & {
  __simLoopTimer__?: ReturnType<typeof setTimeout>;
  __simLoopBooted__?: boolean;
};

export function startSimLoop() {
  if (typeof window !== "undefined") return;
  if (g.__simLoopBooted__) return;
  g.__simLoopBooted__ = true;
  schedule(4_000);
}

function schedule(delayMs: number) {
  if (g.__simLoopTimer__) clearTimeout(g.__simLoopTimer__);
  g.__simLoopTimer__ = setTimeout(() => {
    void fire().then((next) => schedule(next));
  }, delayMs);
}

async function fire(): Promise<number> {
  try {
    const { getSql } = await import("@/lib/db");
    const { loadSimConfig } = await import("@/lib/sim-config");
    const sql = await getSql();
    const cfg = await loadSimConfig(sql);
    const wait = Math.max(10, cfg.tickEverySec) * 1000;
    if (!cfg.autoTick) return wait;
    const { runSimTick } = await import("@/lib/sim-tick");
    await runSimTick(sql);
    return wait;
  } catch (err) {
    console.error("[sim-loop]", err);
    return 30_000;
  }
}
