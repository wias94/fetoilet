import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminGate } from "@/lib/admin-gate";
import {
  getSimAdmin,
  saveSimAdmin,
  saveTextScaleAdmin,
  runSimTickAdmin,
  enableSimLocatedAdmin,
  DEFAULT_SIM,
  simDimWeights,
  simEconCoeffs,
  type SimConfig,
  type SimSnapshot,
} from "@/lib/sim-config";
import { axisHits, deriveMaleDims, dimScore, stallDims } from "@/lib/dims";
import { scoreWithEcon } from "@/lib/econ";
import { textScaleFromRows } from "@/lib/text-scale";
import type { Profile } from "@/lib/profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn, formatFen } from "@/lib/utils";

export const Route = createFileRoute("/admin/sim")({ component: AdminSim });

type Tab = "live" | "attract" | "scale" | "act" | "market" | "gate";
type ScaleRow = { field: string; option: string; axis: string; value: number };

const TABS: { id: Tab; label: string }[] = [
  { id: "live", label: "现场" },
  { id: "attract", label: "吸引" },
  { id: "scale", label: "程度" },
  { id: "act", label: "行为" },
  { id: "market", label: "市场" },
  { id: "gate", label: "限制" },
];

const WEIGHTS: { key: keyof SimConfig; dim: string; label: string }[] = [
  { key: "wAge", dim: "age", label: "年龄" },
  { key: "wHeight", dim: "height", label: "身高" },
  { key: "wWeight", dim: "weight", label: "体重" },
  { key: "wCup", dim: "cup", label: "罩杯" },
  { key: "wPersonality", dim: "personality", label: "性格" },
  { key: "wMarriage", dim: "marriage", label: "婚育" },
  { key: "wDemeanor", dim: "demeanor", label: "姿态" },
  { key: "wMoan", dim: "moan", label: "叫声" },
  { key: "wSkill", dim: "skill", label: "技术" },
  { key: "wOrgasm", dim: "orgasm", label: "高潮" },
  { key: "wFeel", dim: "feel", label: "体感" },
  { key: "wPersona", dim: "persona", label: "人设" },
  { key: "wCondom", dim: "condom", label: "套" },
  { key: "wLooks", dim: "looks", label: "卖点" },
  { key: "wRel", dim: "rel", label: "关系" },
];

const ACT: { key: keyof SimConfig; label: string; hint: string; step?: number }[] = [
  { key: "simTickSec", label: "醒来间隔 s", hint: "同一人两次决定最短间隔" },
  { key: "useScoreMin", label: "点单门槛", hint: "低于此不租别人的", step: 0.01 },
  { key: "selfUseScoreMin", label: "自用门槛", hint: "自己的也要够分", step: 0.01 },
  { key: "buyScoreMin", label: "买货门槛", hint: "wouldBuy 最低吸引", step: 0.01 },
  { key: "maxConcurrentOrders", label: "同时锁单", hint: "男人并行占用" },
  { key: "dailyBudgetFen", label: "日预算 分", hint: "花完停手，0=不限" },
  { key: "walletStopFen", label: "停手现金 分", hint: "低于此不租不买（自用仍可）" },
  { key: "boredSwitchMin", label: "厌了改嫖", hint: "厌腻超此先用别人的", step: 0.01 },
  { key: "satiationHalfUses", label: "厌腻半衰期（次）", hint: "sat = 1 − e^(−次数/此值)", step: 0.1 },
  { key: "selfUseSatiation", label: "自用厌腻重量", hint: "外人用一次=1", step: 0.05 },
  { key: "listKeepThreshold", label: "挂牌保有阈值", hint: "keep 低于此才挂", step: 0.01 },
  { key: "buyCooldownHours", label: "买后冷却 h", hint: "刚买下不立刻再卖" },
];

const MARKET: { key: keyof SimConfig; label: string; hint: string; step?: number }[] = [
  { key: "nearbyRadiusM", label: "附近半径 m", hint: "可见 / 可点" },
  { key: "locationIntervalSec", label: "定位间隔 s", hint: "GPS 刷新" },
  { key: "rentSessionMin", label: "占用分钟", hint: "先到先得锁货" },
  { key: "otherWeekCutPct", label: "外人每周抽 %", hint: "收益下滑" },
  { key: "otherCapPct", label: "外人抽成封顶 %", hint: "" },
  { key: "familyWeekCutPct", label: "家人每周抽 %", hint: "收益下滑" },
  { key: "familyCapPct", label: "家人抽成封顶 %", hint: "" },
  { key: "platformSaleFen", label: "平台转让 分", hint: "C$×100" },
  { key: "platformRentFen", label: "平台出租 分", hint: "一口价" },
  { key: "wealthMeanCad", label: "初始均值 CAD", hint: "对数正态" },
  { key: "wealthSigma", label: "财富 σ", hint: "越大越偏", step: 0.05 },
  { key: "marketUseNorm", label: "市场用量归一", hint: "used7/online", step: 0.1 },
  { key: "marketMulMin", label: "市场乘数底", hint: "", step: 0.01 },
  { key: "marketMulSpan", label: "市场乘数跨度", hint: "", step: 0.01 },
  { key: "rentFloorMul", label: "租价相对底价下限", hint: "", step: 0.01 },
  { key: "rentCeilMul", label: "租价相对底价上限", hint: "", step: 0.01 },
];

const GATES: { key: keyof SimConfig; label: string; hint: string; step?: number }[] = [
  { key: "condomMatchMin", label: "套匹配门槛", hint: "1−|男人−肉厕| 低于此不租不买", step: 0.01 },
  { key: "enforceDailyQuota", label: "执行营业限制", hint: "1=执行一天一客和时段", step: 1 },
  { key: "reviewReturnMin", label: "差评回流", hint: "自己评过或均分低于此不再点，0=关", step: 0.1 },
  { key: "listStaleDays", label: "挂牌过期（天）", hint: "挂了没人买就撤牌" },
];

const DEMO_STALL: Profile = {
  id: "demo",
  name: "试算",
  age: 24,
  heightCm: 165,
  cup: "C",
  tags: ["visit"],
  image: "",
  online: true,
  hourFen: 600,
  nightFen: 900,
  etaMin: 20,
  places: [],
  bio: "",
  services: [],
  work: "",
  ratingAvg: 4.2,
  ratingCount: 6,
  relation: "女友",
  weightKg: 50,
  personality: "温顺讨好",
  marriage: "未婚未育",
  demeanor: "风骚风情诱人魅惑",
  moan: "叫声大叫的骚",
  skillLevel: "优质情人级",
  orgasm: "很容易高潮",
  feel: "荡妇享受",
  persona: "风情万种的骚货",
  condom: "看人可无套",
  sellingPoints: ["高颜值", "反差", "身材好"],
};

function AdminSim() {
  return (
    <AdminGate>
      <AdminSimBody />
    </AdminGate>
  );
}

function AdminSimBody() {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [form, setForm] = useState<SimConfig>(DEFAULT_SIM);
  const [scale, setScale] = useState<ScaleRow[]>([]);
  const [tab, setTab] = useState<Tab>("live");
  const [busy, setBusy] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [objectify, setObjectify] = useState(0.55);

  function reload() {
    return getSimAdmin()
      .then((row) => {
        setSnap(row);
        setForm(row.cfg);
        setScale(row.textScale);
        return row;
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : "读失败");
        return null;
      });
  }

  useEffect(() => {
    void reload();
  }, []);

  const dirty =
    snap != null &&
    (JSON.stringify(form) !== JSON.stringify(snap.cfg) || JSON.stringify(scale) !== JSON.stringify(snap.textScale));

  const demo = useMemo(() => scoreDemo(form, scale, objectify), [form, scale, objectify]);
  const table = useMemo(() => keepTable(form), [form]);

  if (!snap) {
    return <p className="text-sm text-muted">读模拟参数…</p>;
  }

  const run = snap.lastRun;

  function save() {
    setBusy(true);
    void Promise.all([saveSimAdmin({ data: form }), saveTextScaleAdmin({ data: scale })])
      .then(([cfg]) => {
        setForm(cfg);
        setSnap((s) => (s ? { ...s, cfg, textScale: scale } : s));
        toast("已写入 sim_config 和程度表");
      })
      .catch((err) => toast(err instanceof Error ? err.message : "没存成"))
      .finally(() => setBusy(false));
  }

  return (
    <>
      <p className="text-sm text-muted">sim-admin</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">生态</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        吸引分加权平均 → 价格敏感 → 门槛决定自用 / 租 / 买。改完保存，下一轮立刻用。
      </p>

      <div className="sticky top-14 z-20 -mx-4 mt-5 border-y border-border/70 bg-bg/90 px-4 py-2 backdrop-blur-md">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-10 shrink-0 rounded-full px-3.5 text-sm transition-colors",
                tab === t.id ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "live" ? (
        <LiveTab
          snap={snap}
          run={run}
          ticking={ticking}
          busy={busy}
          onTick={() => {
            setTicking(true);
            void runSimTickAdmin()
              .then((res) => {
                toast(`一轮 ${res.males} 人 · 用 ${res.uses}（自用 ${res.selfUses}）· 买 ${res.buys} · 跳过 ${res.skipped}`);
                return reload();
              })
              .catch((err) => toast(err instanceof Error ? err.message : "没跑成"))
              .finally(() => setTicking(false));
          }}
          onEnable={() => {
            setBusy(true);
            void enableSimLocatedAdmin()
              .then((res) => {
                toast(res.n ? `打开了 ${res.n} 个有定位或名下货的男人` : "没有可开的（要有定位或名下货）");
                return reload();
              })
              .catch((err) => toast(err instanceof Error ? err.message : "没打开"))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}

      {tab === "attract" ? (
        <AttractTab form={form} setForm={setForm} demo={demo} objectify={objectify} setObjectify={setObjectify} />
      ) : null}

      {tab === "scale" ? <ScaleTab scale={scale} setScale={setScale} /> : null}

      {tab === "act" ? <ActTab form={form} setForm={setForm} table={table} /> : null}

      {tab === "market" ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKET.map((k) => (
            <NumKnob key={k.key} k={k} form={form} setForm={setForm} />
          ))}
        </div>
      ) : null}

      {tab === "gate" ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted">这四项已经接到 tick。客人路径生效，主人自用不受限。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {GATES.map((k) => (
              <NumKnob key={k.key} k={k} form={form} setForm={setForm} />
            ))}
          </div>
          <ul className="space-y-2 text-sm text-muted">
            <li>套：男人 condom 轴和肉厕程度差太大就不租不买。</li>
            <li>营业：按挂牌「一天一客」等计数；仅晚上/白天/周末按多伦多时间。</li>
            <li>差评：自己评过低于门槛，或均分低于门槛（至少 1 评）不再点。</li>
            <li>过期：listed 后超过天数无人买，tick 开头撤牌。</li>
          </ul>
        </div>
      ) : null}

      <div className="sticky bottom-16 z-20 mt-10 flex flex-wrap gap-2 rounded-2xl bg-surface/95 px-4 py-3 shadow-border backdrop-blur-md md:bottom-4">
        <Button disabled={busy || !dirty} onClick={save}>
          {busy ? "在写…" : dirty ? "保存参数" : "已是当前"}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            setForm(DEFAULT_SIM);
            if (snap) setScale(snap.textScale);
          }}
        >
          恢复默认门槛
        </Button>
      </div>
    </>
  );
}

function LiveTab({
  snap,
  run,
  ticking,
  busy,
  onTick,
  onEnable,
}: {
  snap: SimSnapshot;
  run: SimSnapshot["lastRun"];
  ticking: boolean;
  busy: boolean;
  onTick: () => void;
  onEnable: () => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl bg-surface px-4 py-4 shadow-border">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={ticking} onClick={onTick}>
            {ticking ? "在跑…" : "跑一轮"}
          </Button>
          <Button variant="secondary" type="button" disabled={ticking || busy} onClick={onEnable}>
            打开有定位/有货的男人
          </Button>
        </div>
        {run ? (
          <p className="mt-3 text-sm text-muted">
            上次 {run.males} 人 · 用 {run.uses}（自用 {run.selfUses}）· 买 {run.buys} · 挂 {run.listed} · 跳过 {run.skipped} · {run.durationMs}ms
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">还没跑过。先打开男人，再跑一轮。</p>
        )}
        {run?.notes?.length ? (
          <ul className="mt-2 space-y-1 text-xs text-subtle">
            {run.notes.map((line, i) => (
              <li key={`${line}-${i}`} className="tabular-nums">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="男" value={snap.males} />
        <Stat label="模拟开" value={snap.simEnabled} />
        <Stat label="模拟有定位" value={snap.located} />
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

      <section>
        <h2 className="text-sm font-medium text-muted">关系存量</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {snap.relations.map((r) => (
            <li key={r.rel} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2 text-sm shadow-border">
              <span>{r.rel}</span>
              <span className="tabular-nums">{r.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted">经济观均值</h2>
        <Bars items={snap.econ} />
        <h2 className="mt-8 text-sm font-medium text-muted">关系口味均值</h2>
        <Bars items={snap.taste} />
        <h2 className="mt-8 text-sm font-medium text-muted">位置性格轴均值</h2>
        <Bars items={snap.person} />
      </section>
    </div>
  );
}

function AttractTab({
  form,
  setForm,
  demo,
  objectify,
  setObjectify,
}: {
  form: SimConfig;
  setForm: (fn: (f: SimConfig) => SimConfig) => void;
  demo: ReturnType<typeof scoreDemo>;
  objectify: number;
  setObjectify: (n: number) => void;
}) {
  return (
    <div className="mt-6 space-y-8">
      <section className="grid gap-3 sm:grid-cols-2">
        <Rule
          title="选项档"
          body="罩杯 / 性格 / 姿态：男人给每一档 −1～1，取她那一档再折成 0～1。"
        />
        <Rule
          title="两极"
          body="年龄 / 身高 / 体重：男人 −1～1（幼高瘦 vs 熟矮胖）对着她的归一值。"
        />
        <Rule title="程度" body="叫声、技术、高潮、体感、人设、套、婚育、卖点：1 − |目标 − 实际|。" />
        <Rule title="关系" body="合成一轴：只看她的关系对应男人的 taste。不再被另外七个 0 稀释。" />
      </section>

      <section className="rounded-2xl bg-surface px-4 py-4 shadow-border">
        <p className="text-xs text-muted">试算 · 24 岁 C 杯女友 · 风骚 / 温顺</p>
        <p className="mt-2 font-display text-3xl tabular-nums">{demo.score.toFixed(3)}</p>
        <p className="mt-1 text-sm text-muted">
          轴 {demo.raw.toFixed(3)} → 价格后 {demo.score.toFixed(3)}
          {demo.score >= form.useScoreMin ? " · 会租" : " · 不够租"}
          {demo.score >= form.buyScoreMin ? " · 过买门槛" : " · 不够买"}
        </p>
        <label className="mt-4 block">
          <span className="flex justify-between text-xs text-muted">
            <span>试算男人 objectify</span>
            <span className="tabular-nums">{objectify.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={objectify}
            onChange={(e) => setObjectify(Number(e.target.value))}
            className="mt-2 w-full accent-live"
          />
        </label>
        <ul className="mt-4 space-y-2">
          {demo.hits.map((h) => (
            <li key={h.key}>
              <div className="flex justify-between text-xs">
                <span>
                  {h.key}
                  <span className="text-subtle"> ×{h.weight}</span>
                </span>
                <span className="tabular-nums">{h.match.toFixed(2)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
                <div className="h-full rounded-full bg-live" style={{ width: `${Math.max(2, Math.min(100, h.match * 100))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted">轴权重（0=不算）</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WEIGHTS.map((w) => (
            <RangeKnob
              key={w.key}
              label={w.label}
              hint={w.dim}
              min={0}
              max={3}
              step={0.05}
              value={form[w.key]}
              onChange={(n) => setForm((f) => ({ ...f, [w.key]: n }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted">价格敏感（不是吸引轴）</h2>
        <p className="mt-1 text-xs text-subtle">score × (1 − 抠门×贵) × (1 + 面子×贵) × (1 − 爱租)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <RangeKnob
            label="抠门压价"
            hint="econCashTight"
            min={0}
            max={1}
            step={0.01}
            value={form.econCashTight}
            onChange={(n) => setForm((f) => ({ ...f, econCashTight: n }))}
          />
          <RangeKnob
            label="面子抬价"
            hint="econPrestige"
            min={0}
            max={1}
            step={0.01}
            value={form.econPrestige}
            onChange={(n) => setForm((f) => ({ ...f, econPrestige: n }))}
          />
          <RangeKnob
            label="爱租拖分"
            hint="econRentDrag"
            min={0}
            max={1}
            step={0.01}
            value={form.econRentDrag}
            onChange={(n) => setForm((f) => ({ ...f, econRentDrag: n }))}
          />
        </div>
      </section>
    </div>
  );
}

function ScaleTab({ scale, setScale }: { scale: ScaleRow[]; setScale: (rows: ScaleRow[]) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, ScaleRow[]>();
    for (const row of scale) {
      const list = map.get(row.field) ?? [];
      list.push(row);
      map.set(row.field, list);
    }
    return [...map.entries()];
  }, [scale]);

  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-muted">挂牌文字 → 该字段自己的 0～1。卖点不在这张表：勾选 / 5 = looks。</p>
      {groups.map(([field, rows]) => (
        <section key={field}>
          <h2 className="text-sm font-medium text-muted">{field}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <RangeKnob
                key={`${row.field}-${row.option}-${row.axis}`}
                label={row.option}
                hint={`轴 ${row.axis}`}
                min={0}
                max={1}
                step={0.01}
                value={row.value}
                onChange={(n) =>
                  setScale(
                    scale.map((r) =>
                      r.field === row.field && r.option === row.option && r.axis === row.axis ? { ...r, value: n } : r,
                    ),
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ActTab({
  form,
  setForm,
  table,
}: {
  form: SimConfig;
  setForm: (fn: (f: SimConfig) => SimConfig) => void;
  table: ReturnType<typeof keepTable>;
}) {
  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACT.map((k) => (
          <NumKnob key={k.key} k={k} form={form} setForm={setForm} />
        ))}
      </div>
      <section>
        <h2 className="text-sm font-medium text-muted">厌腻随次数</h2>
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
      </section>
      <section>
        <h2 className="text-sm font-medium text-muted">保有分（红格会挂）</h2>
        <p className="mt-1 text-xs text-subtle">行=次数→厌腻。列=持有周→抽成。阈值 {form.listKeepThreshold}</p>
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
      </section>
    </div>
  );
}

function scoreDemo(cfg: SimConfig, scale: ScaleRow[], objectify: number) {
  const map = textScaleFromRows(scale.length ? scale : []);
  const stall = stallDims(DEMO_STALL, map);
  const male = deriveMaleDims({
    age: 32,
    taste: { 母亲: 0.1, 妻子: 0.25, 女儿: 0.1, 女友: 0.8, 兄妹: 0.05, 朋友: 0.3, 同事: 0.2, 路人: 0.45 },
    sessionStyle: "快餐灌注",
    condomPref: "看货",
    objectify,
    novelty: 0.45,
    risk: 0.35,
    budgetBand: "中",
    familyOrientation: 0.3,
  });
  const weights = simDimWeights(cfg);
  const hits = axisHits(male, stall, DEMO_STALL, weights);
  const raw = dimScore(male, stall, DEMO_STALL, weights);
  const score = scoreWithEcon(raw, DEMO_STALL.hourFen, { cash_tight: 0.4, bargain: 0.4, flip: 0.4, hold: 0.4, rent: 0.3, prestige: 0.4, family_liquidate: 0.3, use_over_own: 0.4 }, simEconCoeffs(cfg));
  return { hits, raw, score };
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3 shadow-border">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function NumKnob({
  k,
  form,
  setForm,
}: {
  k: { key: keyof SimConfig; label: string; hint: string; step?: number };
  form: SimConfig;
  setForm: (fn: (f: SimConfig) => SimConfig) => void;
}) {
  return (
    <label className="rounded-2xl bg-surface px-4 py-3 shadow-border">
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
  );
}

function RangeKnob({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="rounded-2xl bg-surface px-4 py-3 shadow-border">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-live"
      />
      {hint ? <span className="mt-1 block text-xs text-subtle">{hint}</span> : null}
    </label>
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
