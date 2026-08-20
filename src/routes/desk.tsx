import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyStall, saveMyStall } from "@/lib/stalls";
import {
  AREAS,
  PLACE_PRESETS,
  SERVICE_PRESETS,
  STOCK_COVERS,
  TAGS,
  CUPS,
  type Profile,
  type TagId,
} from "@/lib/profiles";
import { cn, formatFen } from "@/lib/utils";

export const Route = createFileRoute("/desk")({ component: DeskPage });

const AREAS_ONLY = AREAS.filter((a) => a !== "附近");
const TAG_OPTIONS = TAGS.filter((t) => t.id !== "all") as { id: TagId; label: string }[];

type Form = {
  name: string;
  age: string;
  heightCm: string;
  cup: string;
  area: string;
  tags: TagId[];
  image: string;
  online: boolean;
  hourYuan: string;
  nightYuan: string;
  etaMin: string;
  places: string[];
  bio: string;
  services: string[];
  confirmedAdult: boolean;
};

const EMPTY: Form = {
  name: "",
  age: "25",
  heightCm: "165",
  cup: "C",
  area: "徐汇",
  tags: ["visit"],
  image: STOCK_COVERS[0]?.image ?? "/profiles/qi.jpg",
  online: true,
  hourYuan: "60",
  nightYuan: "240",
  etaMin: "20",
  places: ["你家", "酒店"],
  bio: "移动肉厕。男人急了叫它走过来。酒店、车上、你家都能冲。冲完走人。",
  services: ["走到你身边", "当马桶冲"],
  confirmedAdult: false,
};

function fromProfile(p: Profile): Form {
  return {
    name: p.name,
    age: String(p.age),
    heightCm: String(p.heightCm),
    cup: p.cup,
    area: p.area,
    tags: p.tags,
    image: p.image,
    online: p.online,
    hourYuan: String(p.hourFen / 100),
    nightYuan: String(p.nightFen / 100),
    etaMin: String(p.etaMin),
    places: p.places,
    bio: p.bio,
    services: p.services,
    confirmedAdult: true,
  };
}

function DeskPage() {
  const { user, isPending } = useCurrentUserState();
  const [mine, setMine] = useState<Profile | null | undefined>(undefined);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    getMyStall()
      .then((row) => {
        if (cancelled) return;
        setMine(row);
        if (row) setForm(fromProfile(row));
      })
      .catch(() => {
        if (!cancelled) setMine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-fg/10" />
      </AppShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/desk" }} />;
  }

  if (mine === undefined) {
    return (
      <AppShell>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-fg/10" />
      </AppShell>
    );
  }

  function toggle<T extends string>(key: "tags" | "places" | "services", value: T) {
    setForm((f) => {
      const cur = f[key] as T[];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...f, [key]: next };
    });
  }

  async function submit() {
    if (!form.confirmedAdult) {
      toast("先确认自己满 25 岁");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMyStall({
        data: {
          name: form.name,
          age: Number(form.age),
          heightCm: Number(form.heightCm),
          cup: form.cup as "B" | "C" | "D" | "E",
          area: form.area,
          tags: form.tags,
          image: form.image,
          online: form.online,
          hourFen: Math.round(Number(form.hourYuan) * 100),
          nightFen: Math.round(Number(form.nightYuan) * 100),
          etaMin: Number(form.etaMin),
          places: form.places,
          bio: form.bio,
          services: form.services,
          confirmedAdult: true as const,
        },
      });
      setMine(saved);
      toast(form.online ? "已挂上货架，男人能叫你过去" : "已登记。开着厕才会出现在附近");
    } catch (err) {
      const message = err instanceof Error ? err.message : "没写成";
      toast(message === "Unauthorized" ? "先登录" : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <p className="text-sm text-muted">女人用的后台</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">登记成肉厕</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        把自己做成公共移动肉厕。填完挂上，前台「附近的肉厕」就会出现这坑，男人能叫你走过去方便。
      </p>

      {mine && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm shadow-border">
          <span className={mine.online ? "text-live" : "text-muted"}>
            {mine.online ? "已开厕，挂在货架上" : "已登记，厕关着"}
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link to="/p/$id" params={{ id: mine.id }}>
              看前台怎么展示
            </Link>
          </Button>
        </div>
      )}

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="这厕对外叫什么">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={12}
            placeholder="厕名"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="岁数">
            <Input
              type="number"
              min={25}
              max={55}
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              required
            />
          </Field>
          <Field label="身高 cm">
            <Input
              type="number"
              min={150}
              max={185}
              value={form.heightCm}
              onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
              required
            />
          </Field>
          <Field label="杯">
            <select
              value={form.cup}
              onChange={(e) => setForm((f) => ({ ...f, cup: e.target.value }))}
              className="h-11 w-full rounded-xl bg-surface px-3 text-base text-fg shadow-border outline-none"
            >
              {CUPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="区">
            <select
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              className="h-11 w-full rounded-xl bg-surface px-3 text-base text-fg shadow-border outline-none"
            >
              {AREAS_ONLY.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="这厕怎么被叫走">
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => (
              <Chip
                key={t.id}
                active={form.tags.includes(t.id)}
                onClick={() => toggle("tags", t.id)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="男人能在哪冲">
          <div className="flex flex-wrap gap-2">
            {PLACE_PRESETS.map((p) => (
              <Chip
                key={p}
                active={form.places.includes(p)}
                onClick={() => toggle("places", p)}
              >
                {p}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="这厕怎么冲">
          <div className="flex flex-wrap gap-2">
            {SERVICE_PRESETS.map((s) => (
              <Chip
                key={s}
                active={form.services.includes(s)}
                onClick={() => toggle("services", s)}
              >
                {s}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="几分钟到">
            <Input
              type="number"
              min={5}
              max={90}
              value={form.etaMin}
              onChange={(e) => setForm((f) => ({ ...f, etaMin: e.target.value }))}
              required
            />
          </Field>
          <Field label="冲一次 ¥">
            <Input
              type="number"
              min={20}
              max={2000}
              value={form.hourYuan}
              onChange={(e) => setForm((f) => ({ ...f, hourYuan: e.target.value }))}
              required
            />
          </Field>
          <Field label="通宵 ¥">
            <Input
              type="number"
              min={80}
              max={8000}
              value={form.nightYuan}
              onChange={(e) => setForm((f) => ({ ...f, nightYuan: e.target.value }))}
              required
            />
          </Field>
        </div>

        <Field label="封面坑（演示用现成图）">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {STOCK_COVERS.map((c) => (
              <button
                key={c.image}
                type="button"
                onClick={() => setForm((f) => ({ ...f, image: c.image }))}
                className={cn(
                  "aspect-[2/3] overflow-hidden rounded-lg",
                  form.image === c.image ? "ring-2 ring-fg" : "opacity-70",
                )}
              >
                <img src={c.image} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </Field>

        <Field label="这厕怎么介绍自己">
          <Textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            maxLength={280}
            required
          />
        </Field>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.online}
            onChange={(e) => setForm((f) => ({ ...f, online: e.target.checked }))}
            className="size-4 accent-fg"
          />
          开着厕，挂到附近货架上
        </label>

        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={form.confirmedAdult}
            onChange={(e) => setForm((f) => ({ ...f, confirmedAdult: e.target.checked }))}
            className="mt-0.5 size-4 accent-fg"
          />
          我已满 25 岁。我知道这是把自己登记成公共移动肉厕，男人能按这页来叫我方便。
        </label>

        <Button className="w-full" type="submit" disabled={saving}>
          {saving ? "在挂…" : mine ? "更新这厕" : "挂上货架"}
        </Button>
        <p className="text-center text-xs text-subtle">
          冲一次 {formatFen(Math.round(Number(form.hourYuan || 0) * 100))} · 通宵{" "}
          {formatFen(Math.round(Number(form.nightYuan || 0) * 100))}
        </p>
      </form>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-3.5 text-sm",
        active ? "bg-fg text-bg" : "bg-surface text-fg shadow-border",
      )}
    >
      {children}
    </button>
  );
}
