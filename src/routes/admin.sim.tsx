import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminGate } from "@/lib/admin-gate";
import { getSimAdmin, saveSimAdmin, DEFAULT_SIM, type SimConfig, type SimSnapshot } from "@/lib/sim-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatFen } from "@/lib/utils";

export const Route = createFileRoute("/admin/sim")({ component: AdminSim });

const KNOBS: { key: keyof SimConfig; label: string; hint: string; step?: number }[] = [
  { key: "nearbyRadiusM", label: "附近半径 m", hint: "可见 / 可点" },
  { key: "locationIntervalSec", label: "定位间隔 s", hint: "GPS 刷新" },
  { key: "rentSessionMin", label: "占用分钟", hint: "先到先得锁货" },
  { key: "otherWeekCutPct", label: "外人每周抽 %", hint: "收益下滑" },
  { key: "otherCapPct", label: "外人抽成封顶 %", hint: "" },
  { key: "familyWeekCutPct", label: "家人每周抽 %", hint: "收益下滑" },
  { key: "familyCapPct", label: "家人抽成封顶 %", hint: "" },
  { key: "listKeepThreshold", label: "挂牌保有阈值", hint: "keep < 此值才挂", step: 0.01 },
  { key: "satiationHalfUses", label: "厌腻半衰期（次）", hint: "按使用次数，不是周", step: 0.1 },
  { key: "selfUseSatiation", label: "自用一次的厌腻重量", hint: "外人用一次=1", step: 0.05 },
  { key: "platformSaleFen", label: "平台转让 分", hint: "C$×100" },
  { key: "platformRentFen", label: "平台出租 分", hint: "一口价" },
  { key: "wealthMeanCad", label: "初始均值 x CAD", hint: "对数正态" },
  { key: "wealthSigma", label: "财富 σ", hint: "越大越偏", step: 0.05 },
  { key: "marketUseNorm", label: "市场用量归一", hint: "used7/online", step: 0.1 },
  { key: "marketMulMin", label: "市场乘数底", hint: "", step: 0.01 },
  { key: "marketMulSpan", label: "市场乘数跨度", hint: "", step: 0.01 },
  { key: "rentFloorMul", label: "租价相对底价下限", hint: "", step: 0.01 },
  { key: "rentCeilMul", label: "租价相对底价上限", hint: "", step: 0.01 },
];

function AdminSim() {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [form, setForm] = useState<SimConfig>(DEFAULT_SIM);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSimAdmin()
      .then((row) => {
        setSnap(row);
        setForm(row.cfg);
      })
      .catch((err) => toast(err instanceof Error ? err.message : "读失败"));
  }, []);

  const table = useMemo(() => keepTable(form), [form]);

  if (!snap) {
    return (
      <AdminGate>
        <p className="text-sm text-muted">读模拟参数…</p>
      </AdminGate>
    );
  }

  return (
    <AdminGate>
      <p className="text-sm text-muted">sim-admin</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">行为与参数</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        数字矩阵和实时分布。厌腻只按使用次数：1−e^(−次数/半衰期)。周只决定抽成。keep = 主人分成 × (1−厌腻)，已抽成且 keep 低于阈值才挂。
      </p>

      <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="男" value={snap.males} />
        <Stat label="厕" value={snap.stalls} />
        <Stat label="平台货" value={snap.platformStalls} />
        <Stat label="转让挂牌" value={snap.listed} />
        <Stat label="占用中" value={snap.busy} />
        <Stat label="现金均值" value={formatFen(snap.wallets.avg)} />
        <Stat label="现金中位" value={formatFen(snap.wallets.med)} />
        <Stat label="现金 p90" value={formatFen(snap.wallets.p90)} />
        <Stat label="7日使用" value={snap.market.used7} />
        <Stat label="在租" value={snap.market.online} />
        <Stat label="市场乘数" value={snap.market.mul.toFixed(2)} />
        <Stat label="厌腻对数" value={snap.satiation.pairs} />
      </section>

      <h2 className="mt-10 text-sm font-medium text-muted">可调参数</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KNOBS.map((k) => (
          <label key={k.key} className="rounded-2xl bg-surface px-4 py-3 shadow-border">
            <span className="text-xs text-muted">{k.label}</span>
            <Input
              className="mt-1"
              type="number"
              step={k.step ?? 1}
              value={form[k.key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [k.key]: e.target.value === "" ? f[k.key] : Number(e.target.value) }))
              }
            />
            {k.hint ? <span className="mt-1 block text-xs text-subtle">{k.hint}</span> : null}
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void saveSimAdmin({ data: form })
              .then((cfg) => {
                setForm(cfg);
                toast("已写入 sim_config");
              })
              .catch((err) => toast(err instanceof Error ? err.message : "没存成"))
              .finally(() => setBusy(false));
          }}
        >
          保存参数
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => setForm(DEFAULT_SIM)}
        >
          恢复默认
        </Button>
      </div>

      <h2 className="mt-10 text-sm font-medium text-muted">厌腻随使用次数（与周无关）</h2>
      <p className="mt-1 text-xs text-subtle">sat = 1 − exp(−次数 / {form.satiationHalfUses})</p>
      <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {[0, 1, 2, 3, 4, 6, 8, 12].map((n) => {
          const sat = 1 - Math.exp(-n / Math.max(0.01, form.satiationHalfUses));
          return (
            <li key={n} className="rounded-2xl bg-surface px-3 py-2 text-center shadow-border">
              <p className="text-xs text-muted">{n} 次</p>
              <p className="mt-1 font-display tabular-nums">{sat.toFixed(2)}</p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 text-sm font-medium text-muted">保有分矩阵（keep，红格会挂牌）</h2>
      <p className="mt-1 text-xs text-subtle">
        行 = 使用次数 → 厌腻。列 = 持有周（只改抽成，不改厌腻）。阈值 {form.listKeepThreshold}
      </p>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-surface p-3 shadow-border">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <thead>
            <tr>
              <th className="p-2 text-muted">次数 \\ 周</th>
              {table.weeks.map((w) => (
                <th key={w.week} className="p-2 text-muted">
                  W{w.week} 家人{w.family}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.uses}>
                <td className="p-2">
                  {row.uses}次 · {row.sat.toFixed(2)}
                </td>
                {row.cells.map((c, i) => (
                  <td key={i} className={c.list ? "p-2 font-medium text-live" : "p-2 text-subtle"}>
                    {c.keep.toFixed(2)}
                    {c.list ? " 挂" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-medium text-muted">经济观均值（behavior_econ）</h2>
      <Bars items={snap.econ} />
      <h2 className="mt-8 text-sm font-medium text-muted">关系口味均值（behavior_male.taste）</h2>
      <Bars items={snap.taste} />
      <h2 className="mt-8 text-sm font-medium text-muted">位置性格轴均值（behavior_person）</h2>
      <Bars items={snap.person} />

      <h2 className="mt-10 text-sm font-medium text-muted">文字程度表（0–1）</h2>
      <p className="mt-1 text-xs text-subtle">罩杯走 chest。卖点不在这张表：选得越多 looks 越高（最多 5 个）。</p>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-surface p-3 shadow-border">
        <table className="w-full min-w-[28rem] text-left text-xs">
          <thead>
            <tr>
              <th className="p-2 text-muted">字段</th>
              <th className="p-2 text-muted">选项</th>
              <th className="p-2 text-muted">轴</th>
              <th className="p-2 text-muted">值</th>
            </tr>
          </thead>
          <tbody>
            {snap.textScale.map((r) => (
              <tr key={`${r.field}-${r.option}-${r.axis}`}>
                <td className="p-2">{r.field}</td>
                <td className="p-2">{r.option}</td>
                <td className="p-2">{r.axis}</td>
                <td className="p-2 tabular-nums">{r.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-medium text-muted">吸引力 24 维（点乘排序）</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {snap.attractKeys.map((k) => (
          <span key={k} className="rounded-full bg-surface px-3 py-1 text-xs shadow-border">
            {k}
          </span>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-medium text-muted">关系存量</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {snap.relations.map((r) => (
          <li key={r.rel} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2 text-sm shadow-border">
            <span>{r.rel}</span>
            <span className="tabular-nums">{r.n}</span>
          </li>
        ))}
      </ul>
    </AdminGate>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3 shadow-border">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Bars({ items }: { items: { key: string; mean: number }[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((it) => (
        <li key={it.key}>
          <div className="flex items-center justify-between text-xs">
            <span>{it.key}</span>
            <span className="tabular-nums">{it.mean.toFixed(2)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-fg/70" style={{ width: `${Math.max(2, Math.min(100, it.mean * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function keepTable(cfg: SimConfig) {
  const weeks = [0, 1, 2, 3, 4, 5].map((week) => ({
    week,
    family: Math.max(0, 100 - Math.min(cfg.familyCapPct, cfg.familyWeekCutPct * week)),
    other: Math.max(0, 100 - Math.min(cfg.otherCapPct, cfg.otherWeekCutPct * week)),
  }));
  const usesList = [0, 1, 2, 4, 6, 8, 12];
  return {
    weeks,
    rows: usesList.map((uses) => {
      const sat = 1 - Math.exp(-uses / Math.max(0.01, cfg.satiationHalfUses));
      return {
        uses,
        sat,
        cells: weeks.map((w) => {
          const share = w.family / 100;
          const keep = share * (1 - sat);
          const started = w.week >= 1;
          return { keep, list: started && keep < cfg.listKeepThreshold };
        }),
      };
    }),
  };
}
