import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  createOwnedStall,
  getMyStall,
  getOwnedStall,
  saveMyStall,
  saveOwnedStall,
  type MineStall,
} from "@/lib/stalls";
import { readStallPhoto } from "@/lib/read-photo";
import {
  AREAS,
  PLACE_PRESETS,
  SERVICE_PRESETS,
  TAGS,
  CUPS,
  RELATIONS,
  type Profile,
  type Relation,
  type TagId,
} from "@/lib/profiles";
import { cn, formatFen } from "@/lib/utils";

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
  ownerToken: string;
  relation: Relation;
};

const EMPTY: Form = {
  name: "",
  age: "18",
  heightCm: "165",
  cup: "C",
  area: "徐汇",
  tags: ["visit"],
  image: "",
  online: true,
  hourYuan: "60",
  nightYuan: "240",
  etaMin: "20",
  places: ["你家", "酒店"],
  bio: "移动肉便器。写清自己：松还是紧、会什么特技、接不接无套。男人急了叫它走过来。冲完走人。别把它当人。",
  services: ["走到你身边", "当马桶冲", "必须套上"],
  confirmedAdult: false,
  ownerToken: "",
  relation: "女友",
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
    ownerToken: "",
    relation: (p.relation as Relation) || "女友",
  };
}

function isShownPhoto(image: string) {
  return (
    image.startsWith("data:image/") ||
    image.startsWith("/profiles/") ||
    image.startsWith("/api/media/") ||
    image.startsWith("https://")
  );
}

export function StallEditor({
  asOwner = false,
  stallId,
  createOwned = false,
}: {
  asOwner?: boolean;
  stallId?: string;
  createOwned?: boolean;
}) {
  const [mine, setMine] = useState<Profile | null | undefined>(undefined);
  const [hasOwner, setHasOwner] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (createOwned) {
      setMine(null);
      return;
    }
    let cancelled = false;
    const load = asOwner && stallId ? getOwnedStall({ data: { id: stallId } }) : getMyStall();
    load
      .then((row) => {
        if (cancelled) return;
        setMine(row);
        if (row) {
          setForm(fromProfile(row));
          setHasOwner("hasOwner" in row ? Boolean((row as MineStall).hasOwner) : Boolean(row.owned));
        }
      })
      .catch(() => {
        if (!cancelled) setMine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [asOwner, stallId, createOwned]);

  if (mine === undefined && !createOwned) {
    return (
      <>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-fg/10" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-fg/10" />
      </>
    );
  }

  if (asOwner && !createOwned && !mine) {
    return <p className="text-sm text-muted">这具不是你名下的货。</p>;
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
      toast("先确认自己满 18 岁");
      return;
    }
    if (!isShownPhoto(form.image)) {
      toast("先上传这具身体的实拍，男人冲的时候就看这张");
      return;
    }
    setSaving(true);
    try {
      const payload = {
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
        ownerToken: form.ownerToken,
      };
      const saved = createOwned
        ? await createOwnedStall({ data: { ...payload, relation: form.relation } })
        : asOwner && stallId
          ? await saveOwnedStall({ data: { ...payload, id: stallId } })
          : await saveMyStall({ data: payload });
      setMine(saved);
      setHasOwner(Boolean(saved.owned) || createOwned || asOwner);
      toast(form.online ? "这具货已挂上，男人能拿去灌" : "挂上了。开着才会出现在货架上当马桶");
      if (createOwned) {
        void navigate({ to: "/owned/$id", params: { id: saved.id } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "没写成";
      toast(message === "Unauthorized" ? "先登录" : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-sm text-muted">
        {createOwned ? "男人端 · 把身边的女人挂成肉厕" : asOwner ? "男人端 · 名下的货" : "肉厕端 · 货卡"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
        {createOwned
          ? "把她挂成你的肉厕"
          : asOwner
            ? "改这具所属肉厕"
            : mine
              ? "改这具马桶的挂牌"
              : "把这具身体挂成公共肉厕"}
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        {createOwned
          ? "妻子、母亲、女友都可以。挂上归你，别人冲她，钱进你口袋。"
          : asOwner
            ? "这具挂在你名下。货卡内容你说了算。也可以挂牌转给别的男人。"
            : "所有者口令选填。不填就是无主货，被人灌了没人收钱。有主之后钱归主人。"}
      </p>

      {mine && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm shadow-border">
          <span className={mine.online ? "text-live" : "text-muted"}>
            {mine.online ? "这具在货架上，可灌" : "挂上了，这具先不给人用"}
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link to="/p/$id" params={{ id: mine.id }}>
              男人冲的时候看的页
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
        <Field label="这具货对外叫什么">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={12}
            placeholder="厕名，不是人名"
            required
          />
        </Field>

        {!asOwner && !createOwned && (
          <Field label="所有者口令（选填）">
            {hasOwner ? (
              <p className="text-sm text-muted">已有主。冲一次的钱进主人口袋。</p>
            ) : (
              <>
                <Input
                  value={form.ownerToken}
                  onChange={(e) => setForm((f) => ({ ...f, ownerToken: e.target.value }))}
                  placeholder="XC-********  不填就是无主"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-subtle">填了立刻归他。不填也能挂，只是被人用了没人收钱。</p>
              </>
            )}
          </Field>
        )}

        {createOwned && (
          <Field label="她是你的什么">
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => (
                <Chip key={r} active={form.relation === r} onClick={() => setForm((f) => ({ ...f, relation: r }))}>
                  {r}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="岁数">
            <Input
              type="number"
              min={18}
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

        <Field label="这具便器怎么被叫走">
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => (
              <Chip key={t.id} active={form.tags.includes(t.id)} onClick={() => toggle("tags", t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="男人能在哪冲">
          <div className="flex flex-wrap gap-2">
            {PLACE_PRESETS.map((p) => (
              <Chip key={p} active={form.places.includes(p)} onClick={() => toggle("places", p)}>
                {p}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="这具便器怎么冲">
          <div className="flex flex-wrap gap-2">
            {SERVICE_PRESETS.map((s) => (
              <Chip key={s} active={form.services.includes(s)} onClick={() => toggle("services", s)}>
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

        <Field label="这具身体的实拍">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setReading(true);
              void readStallPhoto(file)
                .then((image) => setForm((f) => ({ ...f, image })))
                .catch((err) => toast(err instanceof Error ? err.message : "图没读成"))
                .finally(() => setReading(false));
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative block w-full overflow-hidden rounded-2xl bg-sunken text-left shadow-border"
          >
            {isShownPhoto(form.image) ? (
              <img src={form.image} alt="" className="aspect-[2/3] w-full object-cover object-top sm:max-h-[28rem]" />
            ) : (
              <div className="flex aspect-[2/3] max-h-72 flex-col items-center justify-center gap-2 px-6 text-center sm:max-h-80">
                <p className="font-display text-lg">上传实拍</p>
                <p className="text-sm text-muted">自己的图。不要演示封面。</p>
              </div>
            )}
          </button>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            {reading ? "在压图…" : form.image ? "换这具的实拍" : "从相册选这具的图"}
          </Button>
        </Field>

        <Field label="这具货怎么介绍">
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
          开着，让男人把这具当马桶从货架上叫走
        </label>

        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={form.confirmedAdult}
            onChange={(e) => setForm((f) => ({ ...f, confirmedAdult: e.target.checked }))}
            className="mt-0.5 size-4 accent-fg"
          />
          我已满 18 岁。我知道这是把这具身体登记成公共移动肉厕。男人按货来叫，拿去灌注。不是人，是马桶。
        </label>

        <Button className="w-full" type="submit" disabled={saving}>
          {saving ? "在挂…" : mine ? "更新这具货卡" : "把这具挂上货架"}
        </Button>
        <p className="text-center text-xs text-subtle">
          冲一次 {formatFen(Math.round(Number(form.hourYuan || 0) * 100))} · 通宵{" "}
          {formatFen(Math.round(Number(form.nightYuan || 0) * 100))}
        </p>
      </form>
    </>
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
