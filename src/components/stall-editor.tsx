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
  type ExtraFee,
  type Profile,
  type Relation,
  type TagId,
} from "@/lib/profiles";
import {
  CONDOMS,
  DAILY_QUOTAS,
  DEMEANORS,
  DEPOSITS,
  FEELS,
  HOURS_TAGS,
  IDENTITIES,
  LISTING_DEFAULTS,
  MARRIAGES,
  MOANS,
  NAME_PRESETS,
  ORGASMS,
  PERSONAS,
  REVIEW_PREFS,
  SELLING_POINTS,
  SKILLS,
  TRAVELS,
  composeListingBio,
  digitsOnly,
} from "@/lib/listing";
import { cn, formatFen } from "@/lib/utils";

const AREAS_ONLY = AREAS.filter((a) => a !== "附近");
const TAG_OPTIONS = TAGS.filter((t) => t.id !== "all") as { id: TagId; label: string }[];
const STEPS = ["保证金", "档案", "表现", "接客", "照片"] as const;

type Form = {
  name: string;
  age: string;
  heightCm: string;
  weightKg: string;
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
  stallEmail: string;
  relation: Relation;
  identity: (typeof IDENTITIES)[number];
  marriage: (typeof MARRIAGES)[number];
  demeanor: (typeof DEMEANORS)[number];
  moan: (typeof MOANS)[number];
  skillLevel: (typeof SKILLS)[number];
  orgasm: (typeof ORGASMS)[number];
  feel: (typeof FEELS)[number];
  persona: (typeof PERSONAS)[number];
  sellingPoints: string[];
  hoursTag: (typeof HOURS_TAGS)[number];
  dailyQuota: (typeof DAILY_QUOTAS)[number];
  travel: (typeof TRAVELS)[number];
  condom: (typeof CONDOMS)[number];
  extras: ExtraFee[];
  reviewPref: (typeof REVIEW_PREFS)[number];
  depositFen: number;
};

const EMPTY: Form = {
  name: "",
  age: "18",
  heightCm: "165",
  weightKg: String(LISTING_DEFAULTS.weightKg),
  cup: "C",
  area: "徐汇",
  tags: ["visit"],
  image: "",
  online: true,
  hourYuan: "60",
  nightYuan: "240",
  etaMin: "20",
  places: ["你家", "酒店"],
  bio: "在册肉厕。请如实填写可提供之服务、是否接受无套灌注及到达时效。客户点单后按货品使用。",
  services: ["口交", "性交"],
  confirmedAdult: false,
  ownerToken: "",
  stallEmail: "",
  relation: "女友",
  identity: LISTING_DEFAULTS.identity,
  marriage: LISTING_DEFAULTS.marriage,
  demeanor: LISTING_DEFAULTS.demeanor,
  moan: LISTING_DEFAULTS.moan,
  skillLevel: LISTING_DEFAULTS.skillLevel,
  orgasm: LISTING_DEFAULTS.orgasm,
  feel: LISTING_DEFAULTS.feel,
  persona: LISTING_DEFAULTS.persona,
  sellingPoints: [],
  hoursTag: LISTING_DEFAULTS.hoursTag,
  dailyQuota: LISTING_DEFAULTS.dailyQuota,
  travel: LISTING_DEFAULTS.travel,
  condom: LISTING_DEFAULTS.condom,
  extras: [],
  reviewPref: LISTING_DEFAULTS.reviewPref,
  depositFen: LISTING_DEFAULTS.depositFen,
};

function fromProfile(p: Profile): Form {
  return {
    ...EMPTY,
    name: p.name,
    age: String(p.age),
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg ?? LISTING_DEFAULTS.weightKg),
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
    relation: (p.relation as Relation) || "女友",
    stallEmail: "",
    identity: (p.identity as Form["identity"]) || LISTING_DEFAULTS.identity,
    marriage: (p.marriage as Form["marriage"]) || LISTING_DEFAULTS.marriage,
    demeanor: (p.demeanor as Form["demeanor"]) || LISTING_DEFAULTS.demeanor,
    moan: (p.moan as Form["moan"]) || LISTING_DEFAULTS.moan,
    skillLevel: (p.skillLevel as Form["skillLevel"]) || LISTING_DEFAULTS.skillLevel,
    orgasm: (p.orgasm as Form["orgasm"]) || LISTING_DEFAULTS.orgasm,
    feel: (p.feel as Form["feel"]) || LISTING_DEFAULTS.feel,
    persona: (p.persona as Form["persona"]) || LISTING_DEFAULTS.persona,
    sellingPoints: p.sellingPoints ?? [],
    hoursTag: (p.hoursTag as Form["hoursTag"]) || LISTING_DEFAULTS.hoursTag,
    dailyQuota: (p.dailyQuota as Form["dailyQuota"]) || LISTING_DEFAULTS.dailyQuota,
    travel: (p.travel as Form["travel"]) || LISTING_DEFAULTS.travel,
    condom: (p.condom as Form["condom"]) || LISTING_DEFAULTS.condom,
    extras: p.extras ?? [],
    reviewPref: (p.reviewPref as Form["reviewPref"]) || LISTING_DEFAULTS.reviewPref,
    depositFen: p.depositFen ?? LISTING_DEFAULTS.depositFen,
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
  const [step, setStep] = useState(0);
  const [extraName, setExtraName] = useState("");
  const [extraYuan, setExtraYuan] = useState("50");
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

  function toggle<T extends string>(key: "tags" | "places" | "services" | "sellingPoints", value: T) {
    setForm((f) => {
      const cur = f[key] as T[];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
      if (key === "services") {
        const names = next as string[];
        return { ...f, services: names, extras: f.extras.filter((e) => names.includes(e.name)) };
      }
      return { ...f, [key]: next };
    });
  }

  function listingPayload() {
    return {
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
      bio: form.bio.trim(),
      services: form.services,
      confirmedAdult: true as const,
      ownerToken: form.ownerToken,
      weightKg: Number(form.weightKg),
      identity: form.identity,
      marriage: form.marriage,
      demeanor: form.demeanor,
      moan: form.moan,
      skillLevel: form.skillLevel,
      orgasm: form.orgasm,
      feel: form.feel,
      persona: form.persona,
      sellingPoints: form.sellingPoints,
      hoursTag: form.hoursTag,
      dailyQuota: form.dailyQuota,
      travel: form.travel,
      condom: form.condom,
      extras: form.extras,
      reviewPref: form.reviewPref,
      depositFen: form.depositFen,
    };
  }

  function canNext() {
    if (step === 0) {
      if (!form.confirmedAdult) return false;
      if (createOwned && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.stallEmail.trim())) return false;
      return true;
    }
    if (step === 1) {
      const age = Number(form.age);
      const height = Number(form.heightCm);
      const weight = Number(form.weightKg);
      if (form.name.trim().length === 0) return false;
      if (!Number.isInteger(age) || age < 18 || age > 55) return false;
      if (!Number.isInteger(height) || height < 150 || height > 185) return false;
      if (!Number.isInteger(weight) || weight < 35 || weight > 120) return false;
      return true;
    }
    if (step === 3) {
      const eta = Number(form.etaMin);
      const hour = Number(form.hourYuan);
      const night = Number(form.nightYuan);
      if (!Number.isInteger(eta) || eta < 5 || eta > 90) return false;
      if (!Number.isInteger(hour) || hour < 20 || hour > 2000) return false;
      if (!Number.isInteger(night) || night < 80 || night > 8000) return false;
      return form.places.length > 0 && form.services.length > 0 && form.tags.length > 0;
    }
    if (step === 4) return isShownPhoto(form.image) && form.bio.trim().length >= 8;
    return true;
  }

  async function submit() {
    if (!form.confirmedAdult) {
      toast("先确认已满 18 岁");
      setStep(0);
      return;
    }
    if (!isShownPhoto(form.image)) {
      toast("先上传实拍");
      setStep(4);
      return;
    }
    setSaving(true);
    try {
      const payload = listingPayload();
      if (createOwned) {
        const saved = await createOwnedStall({
          data: { ...payload, relation: form.relation, stallEmail: form.stallEmail.trim().toLowerCase() },
        });
        setMine(saved);
        setHasOwner(true);
        sessionStorage.setItem(
          `stall-login:${saved.id}`,
          JSON.stringify({ email: saved.loginEmail, password: saved.loginPassword }),
        );
        toast(form.online ? "已挂牌，开始接询" : "挂上了。开着才会出现在货架上");
        void navigate({ to: "/owned/$id", params: { id: saved.id } });
        return;
      }
      const saved =
        asOwner && stallId
          ? await saveOwnedStall({ data: { ...payload, id: stallId } })
          : await saveMyStall({ data: payload });
      setMine(saved);
      setHasOwner(Boolean(saved.owned) || asOwner);
      toast(form.online ? "已挂牌，开始接询" : "挂上了。开着才会出现在货架上");
    } catch (err) {
      const message = err instanceof Error ? err.message : "没写成";
      toast(message === "Unauthorized" ? "先登录" : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-sm text-muted">巷厕 · 挂牌交易所</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
        {createOwned ? "把她挂牌出售 / 出租" : asOwner ? "改挂牌资料" : mine ? "改这具挂牌" : "肉厕挂牌登记"}
      </h1>

      <ol className="mt-5 flex gap-1">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "w-full truncate rounded-full px-2 py-1.5 text-[11px]",
                i === step ? "bg-fg text-bg" : i < step ? "bg-primary-soft text-fg" : "bg-sunken text-subtle",
              )}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>

      {mine && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm shadow-border">
          <span className={mine.online ? "text-live" : "text-muted"}>
            {mine.online ? "挂牌中" : "已登记，未上架"}
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link to="/p/$id" params={{ id: mine.id }}>
              客户看到的页
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {step === 0 && (
          <>
            <div className="space-y-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed text-muted shadow-border">
              <p>欢迎进入肉厕挂牌交易所。</p>
              <p>
                妻子、母亲、已满 18 岁的女儿、女友可以在这里登记挂牌。同事核验更严。未满 18
                岁一律不收。
              </p>
              <p>
                登记后必须能接单。放鸽子会扣履约保证金。核验通过后会出现在货架上，客户随时点单。
              </p>
            </div>
            {createOwned && (
              <>
                <Field label="她是你的什么（妻子、母亲、成年女儿核验简单；同事较复杂）">
                  <div className="flex flex-wrap gap-2">
                    {RELATIONS.map((r) => (
                      <Chip key={r} active={form.relation === r} onClick={() => setForm((f) => ({ ...f, relation: r }))}>
                        {r}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="肉厕登录邮箱（注册后生成密码，她用这组进肉厕端）">
                  <Input
                    type="email"
                    autoComplete="off"
                    value={form.stallEmail}
                    onChange={(e) => setForm((f) => ({ ...f, stallEmail: e.target.value }))}
                    placeholder="她的邮箱，不能和你的相同"
                    required
                  />
                </Field>
              </>
            )}
            <Field label="你能承担的履约保证金">
              <div className="flex flex-wrap gap-2">
                {DEPOSITS.map((d) => (
                  <Chip
                    key={d.fen}
                    active={form.depositFen === d.fen}
                    onClick={() => setForm((f) => ({ ...f, depositFen: d.fen }))}
                  >
                    {d.label}
                  </Chip>
                ))}
              </div>
            </Field>
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={form.confirmedAdult}
                onChange={(e) => setForm((f) => ({ ...f, confirmedAdult: e.target.checked }))}
                className="mt-0.5 size-4 accent-fg"
              />
              本人确认被挂牌者已满 18 岁，登记后能正式接单。放鸽子扣保证金。
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="对外称呼（点选或填写汉字）">
              <div className="mb-2 flex flex-wrap gap-2">
                {NAME_PRESETS.map((n) => (
                  <Chip key={n} active={form.name === n} onClick={() => setForm((f) => ({ ...f, name: n }))}>
                    {n}
                  </Chip>
                ))}
              </div>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value.replace(/[^\u4e00-\u9fa5A-Za-z]/g, "").slice(0, 12) }))
                }
                maxLength={12}
                placeholder="点选上方或填写"
                required
              />
            </Field>
            {!asOwner && !createOwned && (
              <Field label="所有者口令（选填）">
                {hasOwner ? (
                  <p className="text-sm text-muted">已有主。钱进主人口袋。</p>
                ) : (
                  <Input
                    value={form.ownerToken}
                    onChange={(e) => setForm((f) => ({ ...f, ownerToken: e.target.value }))}
                    placeholder="XC-********  不填就是无主"
                    autoComplete="off"
                  />
                )}
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField
                label="年龄"
                unit="岁"
                min={18}
                max={55}
                value={form.age}
                onValue={(age) => setForm((f) => ({ ...f, age }))}
              />
              <NumField
                label="身高"
                unit="cm"
                min={150}
                max={185}
                value={form.heightCm}
                onValue={(heightCm) => setForm((f) => ({ ...f, heightCm }))}
              />
              <NumField
                label="体重"
                unit="kg"
                min={35}
                max={120}
                value={form.weightKg}
                onValue={(weightKg) => setForm((f) => ({ ...f, weightKg }))}
              />
              <Field label="罩杯">
                <div className="flex flex-wrap gap-2">
                  {CUPS.map((c) => (
                    <Chip key={c} active={form.cup === c} onClick={() => setForm((f) => ({ ...f, cup: c }))}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="区">
              <div className="flex flex-wrap gap-2">
                {AREAS_ONLY.map((a) => (
                  <Chip key={a} active={form.area === a} onClick={() => setForm((f) => ({ ...f, area: a }))}>{a}</Chip>
                ))}
              </div>
            </Field>
            <Field label="身份">
              <div className="flex flex-wrap gap-2">
                {IDENTITIES.map((v) => (
                  <Chip key={v} active={form.identity === v} onClick={() => setForm((f) => ({ ...f, identity: v }))}>{v}</Chip>
                ))}
              </div>
            </Field>
            <Field label="婚育">
              <div className="flex flex-wrap gap-2">
                {MARRIAGES.map((v) => (
                  <Chip key={v} active={form.marriage === v} onClick={() => setForm((f) => ({ ...f, marriage: v }))}>{v}</Chip>
                ))}
              </div>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Pick label="表现" options={DEMEANORS} value={form.demeanor} onPick={(v) => setForm((f) => ({ ...f, demeanor: v }))} />
            <Pick label="叫床" options={MOANS} value={form.moan} onPick={(v) => setForm((f) => ({ ...f, moan: v }))} />
            <Pick label="技术级别" options={SKILLS} value={form.skillLevel} onPick={(v) => setForm((f) => ({ ...f, skillLevel: v }))} />
            <Pick label="高潮难度" options={ORGASMS} value={form.orgasm} onPick={(v) => setForm((f) => ({ ...f, orgasm: v }))} />
            <Pick label="使用感受" options={FEELS} value={form.feel} onPick={(v) => setForm((f) => ({ ...f, feel: v }))} />
            <Pick label="最贴切的标签" options={PERSONAS} value={form.persona} onPick={(v) => setForm((f) => ({ ...f, persona: v }))} />
            <Field label="卖点（可多选，别夸张）">
              <div className="flex flex-wrap gap-2">
                {SELLING_POINTS.map((s) => (
                  <Chip key={s} active={form.sellingPoints.includes(s)} onClick={() => toggle("sellingPoints", s)}>{s}</Chip>
                ))}
              </div>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Pick label="可服务时间" options={HOURS_TAGS} value={form.hoursTag} onPick={(v) => setForm((f) => ({ ...f, hoursTag: v }))} />
            <Pick label="一天接客" options={DAILY_QUOTAS} value={form.dailyQuota} onPick={(v) => setForm((f) => ({ ...f, dailyQuota: v }))} />
            <Pick label="上门地域" options={TRAVELS} value={form.travel} onPick={(v) => setForm((f) => ({ ...f, travel: v }))} />
            <Pick label="安全措施" options={CONDOMS} value={form.condom} onPick={(v) => setForm((f) => ({ ...f, condom: v }))} />
            <Field label="怎么被叫走">
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((t) => (
                  <Chip key={t.id} active={form.tags.includes(t.id)} onClick={() => toggle("tags", t.id)}>{t.label}</Chip>
                ))}
              </div>
            </Field>
            <Field label="能在哪">
              <div className="flex flex-wrap gap-2">
                {PLACE_PRESETS.map((p) => (
                  <Chip key={p} active={form.places.includes(p)} onClick={() => toggle("places", p)}>{p}</Chip>
                ))}
              </div>
            </Field>
            <Field label="提供服务">
              <div className="flex flex-wrap gap-2">
                {SERVICE_PRESETS.map((s) => (
                  <Chip key={s} active={form.services.includes(s)} onClick={() => toggle("services", s)}>{s}</Chip>
                ))}
              </div>
            </Field>
            <Field label="加价项目（从已选服务里选，填加价金额）">
              {form.services.length === 0 ? (
                <p className="text-sm text-subtle">先勾选上方服务</p>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <select
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                    className="h-11 min-w-32 flex-1 rounded-xl bg-surface px-3 text-sm shadow-border"
                  >
                    <option value="">选择服务</option>
                    {form.services
                      .filter((s) => !form.extras.some((e) => e.name === s))
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                  <div className="w-28">
                    <Input
                      inputMode="numeric"
                      value={extraYuan}
                      onChange={(e) => setExtraYuan(digitsOnly(e.target.value))}
                      placeholder="加价"
                    />
                  </div>
                  <span className="pb-3 text-sm text-muted">元</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const name = extraName || form.services.find((s) => !form.extras.some((e) => e.name === s)) || "";
                      const yuan = Number(extraYuan);
                      if (!name) {
                        toast("先选一项服务");
                        return;
                      }
                      if (!Number.isInteger(yuan) || yuan < 1) {
                        toast("加价至少 1 元");
                        return;
                      }
                      setForm((f) => ({ ...f, extras: [...f.extras, { name, fen: yuan * 100 }] }));
                      setExtraName("");
                    }}
                  >
                    加入
                  </Button>
                </div>
              )}
              {form.extras.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {form.extras.map((e) => (
                    <li key={e.name} className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2 text-sm">
                      <span>
                        {e.name}
                        <span className="ml-2 tabular-nums text-muted">+{formatFen(e.fen)}</span>
                      </span>
                      <button
                        type="button"
                        className="text-subtle hover:text-fg"
                        onClick={() => setForm((f) => ({ ...f, extras: f.extras.filter((x) => x.name !== e.name) }))}
                      >
                        去掉
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            <Pick label="公开点评" options={REVIEW_PREFS} value={form.reviewPref} onPick={(v) => setForm((f) => ({ ...f, reviewPref: v }))} />
            <div className="grid grid-cols-3 gap-3">
              <NumField
                label="抵达"
                unit="分钟"
                min={5}
                max={90}
                value={form.etaMin}
                onValue={(etaMin) => setForm((f) => ({ ...f, etaMin }))}
              />
              <NumField
                label="单次"
                unit="元"
                min={20}
                max={2000}
                value={form.hourYuan}
                onValue={(hourYuan) => setForm((f) => ({ ...f, hourYuan }))}
              />
              <NumField
                label="通宵"
                unit="元"
                min={80}
                max={8000}
                value={form.nightYuan}
                onValue={(nightYuan) => setForm((f) => ({ ...f, nightYuan }))}
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Field label="照片（真实、好看，直接决定问询）">
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
              <Button type="button" variant="secondary" className="mt-3" disabled={reading} onClick={() => fileRef.current?.click()}>
                {reading ? "在压图…" : form.image ? "换一张" : "从相册选"}
              </Button>
            </Field>
            <Field label="简介（手打，8–280 字）">
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 280) }))}
                maxLength={280}
                required
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-subtle">{form.bio.trim().length}/280</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      bio: composeListingBio({
                        persona: f.persona,
                        age: Number(f.age) || 18,
                        heightCm: Number(f.heightCm) || 165,
                        weightKg: Number(f.weightKg) || 50,
                        cup: f.cup,
                        identity: f.identity,
                        marriage: f.marriage,
                        demeanor: f.demeanor,
                        moan: f.moan,
                        skillLevel: f.skillLevel,
                        orgasm: f.orgasm,
                        feel: f.feel,
                        condom: f.condom,
                        hoursTag: f.hoursTag,
                        dailyQuota: f.dailyQuota,
                        travel: f.travel,
                        sellingPoints: f.sellingPoints,
                      }),
                    }))
                  }
                >
                  用选项填一份草稿
                </Button>
              </div>
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={form.online} onChange={(e) => setForm((f) => ({ ...f, online: e.target.checked }))} className="size-4 accent-fg" />
              审核后立刻上架接询
            </label>
            <p className="text-sm text-muted">
              {form.persona} · {form.condom} · 保证金 {formatFen(form.depositFen)} · 一次{" "}
              {formatFen(Math.round(Number(form.hourYuan || 0) * 100))}
            </p>
          </>
        )}

        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              上一步
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="flex-1"
              disabled={!canNext()}
              onClick={() => {
                if (!canNext()) {
                  toast(step === 0 ? "先确认满 18 岁" : "先把这页填完");
                  return;
                }
                setStep((s) => s + 1);
              }}
            >
              下一步
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={saving || !canNext()} onClick={() => void submit()}>
              {saving ? "在挂…" : mine ? "更新挂牌" : "提交登记"}
            </Button>
          )}
        </div>
      </div>
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

function NumField({
  label,
  unit,
  value,
  min,
  max,
  onValue,
}: {
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  onValue: (v: string) => void;
}) {
  return (
    <Field label={`${label}（${unit}）`}>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onValue(digitsOnly(e.target.value))}
          className="tabular-nums"
        />
        <span className="w-10 shrink-0 text-sm text-muted">{unit}</span>
      </div>
      <p className="mt-1 text-[11px] text-subtle">
        {min}–{max} {unit}，仅数字
      </p>
    </Field>
  );
}

function Pick<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onPick(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </Field>
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
