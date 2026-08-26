#!/usr/bin/env python3
"""One-shot: turn location CSVs into a compact 巷厕 seed with person_id links."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

POP = Path("/tmp/pop.csv")
REL = Path("/tmp/rel.csv")
PROF = Path("/tmp/prof.csv")
HOMES = Path("/tmp/person_places.csv")
PLACES = Path("/tmp/places.csv")
OUT = Path("/workspace/data/gta-seed.json")

PHOTOS = [
    "/profiles/qi.jpg",
    "/profiles/wan.jpg",
    "/profiles/su.jpg",
    "/profiles/mina.jpg",
    "/profiles/bei.jpg",
    "/profiles/lin.jpg",
    "/profiles/ke.jpg",
    "/profiles/shen.jpg",
]

JOB_MAP = [
    ("护士", "护士"),
    ("护理", "护士"),
    ("教师", "教师"),
    ("老师", "教师"),
    ("教授", "教师"),
    ("销售", "销售"),
    ("房产", "销售"),
    ("经纪", "销售"),
    ("自媒体", "主播网红"),
    ("主播", "主播网红"),
    ("网店", "主播网红"),
    ("服务员", "服务员"),
    ("餐厅", "服务员"),
    ("酒店", "服务员"),
    ("咖啡", "服务员"),
    ("收银", "服务员"),
    ("客服", "服务员"),
    ("美容", "服务员"),
    ("厨师", "服务员"),
    ("前台", "服务员"),
    ("本科", "在校学生"),
    ("硕士", "在校学生"),
    ("博士", "在校学生"),
]


def h01(pid: str, salt: str) -> float:
    d = hashlib.sha256(f"{pid}:{salt}".encode()).digest()
    return int.from_bytes(d[:2], "big") / 65535


def job_of(row: dict) -> tuple[str, str]:
    title = row.get("具体职位") or ""
    code = row.get("occupation_code") or ""
    for key, job in JOB_MAP:
        if key in title:
            ident = "在校（仅18+）" if job == "在校学生" else "自由职业" if job in ("主播网红", "无业", "全职主妇") else "在职"
            return job, ident
    if code == "university_student":
        return "在校学生", "在校（仅18+）"
    if code == "freelancer":
        return "无业", "自由职业"
    return "公司职员", "在职"


def personality_of(prof: dict | None, family: str) -> str:
    if not prof:
        return "温顺讨好"
    soc = float(prof.get("sociability") or 0.5)
    warm = float(prof.get("warmth") or 0.5)
    fam = float(prof.get("family_orientation") or 0.5)
    night = float(prof.get("nightlife_preference") or 0.5)
    direct = float(prof.get("directness") or 0.5)
    style = prof.get("communication_style") or ""
    if fam > 0.7 and warm > 0.45 and soc < 0.45:
        return "隐忍顾家"
    if "健谈" in style or "热情" in style or (soc > 0.7 and night > 0.55):
        return "外向热闹"
    if soc < 0.35 and night > 0.55:
        return "内向闷骚"
    if direct > 0.7 and warm < 0.4:
        return "清高要强"
    if soc < 0.3 and warm < 0.35:
        return "冷淡疏离"
    if soc > 0.6 and fam < 0.35 and night > 0.5:
        return "作精骄纵"
    if warm > 0.65 and soc > 0.4:
        return "软萌粘人"
    if "温和" in style:
        return "温顺讨好"
    return "温顺讨好"


PERSONAS = [
    ("有待开发的良家", 18),
    ("反差装逼的婊子", 22),
    ("风情万种的骚货", 18),
    ("淫荡风骚的荡妇", 16),
    ("欠操下贱的母狗", 14),
    ("专业熟练的妓女", 12),
]


def persona_of(pid: str, relation: str, job: str) -> str:
    # 母亲/女儿/学生略偏反差与良家，但不让良家占头
    bump = []
    if relation in ("母亲", "女儿") or job == "在校学生":
        bump = [("有待开发的良家", 10), ("反差装逼的婊子", 18)]
    if job in ("主播网红", "销售"):
        bump = [("风情万种的骚货", 16), ("淫荡风骚的荡妇", 16), ("专业熟练的妓女", 10)]
    weights = dict(PERSONAS)
    for k, v in bump:
        weights[k] = weights.get(k, 0) + v
    # 良家再削一点
    weights["有待开发的良家"] = max(8, weights.get("有待开发的良家", 18) - 6)
    total = sum(weights.values())
    x = h01(pid, "persona") * total
    acc = 0.0
    for name, w in weights.items():
        acc += w
        if x <= acc:
            return name
    return "反差装逼的婊子"


def listing(pid: str, age: int, relation: str, job: str, ident: str, personality: str, marriage: str) -> dict:
    youth = max(0, min(1, 1 - (age - 18) / 22))
    exp = min(1, 0.15 + (age - 18) / 30)
    if relation in ("母亲", "妻子"):
        exp = min(1, exp + 0.15)
    if job == "在校学生":
        exp = max(0.05, exp - 0.12)
    lewd = 0.25 + (0 if personality in ("隐忍顾家", "清高要强", "冷淡疏离") else 0.15)
    if personality in ("外向热闹", "作精骄纵"):
        lewd += 0.2
    if personality == "内向闷骚":
        lewd += 0.12
    demeanors = ["被动保守呆板生涩", "羞涩需要引导鼓励", "自然开放积极配合", "风骚风情诱人魅惑", "主动豪放热情放荡", "卑微下贱无脑淫痴"]
    moans = ["不吭声没动静", "只会轻喘呻吟", "叫声大叫的骚", "淫语骚话不停"]
    skills = ["入门基础级", "常规伴侣级", "优质情人级", "专业技师级"]
    orgasms = ["从未高潮", "不易高潮", "很难把握", "正常可以高潮", "很容易高潮", "可以多次连续高潮"]
    feels = ["纯粹泄欲", "愉悦身心", "绝顶肉体", "荡妇享受", "大开眼界"]
    def pick(score, arr):
        i = min(len(arr) - 1, max(0, int(score * len(arr) - 1e-9)))
        return arr[i]
    hours = "仅周末可接" if ident == "在校（仅18+）" else "全天可接" if ident == "自由职业" else "仅晚上可接"
    condom = pick(lewd, ["必须带套", "看人可无套", "加钱可无套", "均可无套"])
    if job == "在校学生":
        condom = "必须带套"
    points = []
    if youth > 0.6:
        points.append("逼紧")
    if personality in ("隐忍顾家", "温顺讨好"):
        points.append("奴性强")
    if relation in ("母亲", "妻子", "女儿") or job in ("教师", "护士", "在校学生", "公务员"):
        points.append("反差")
        points.append("特殊职业身份")
    if personality == "外向热闹":
        points.append("淫语")
    if exp > 0.55:
        points.append("技术好活儿好")
    if not points:
        points = ["气质反差", "反差"]
    return {
        "demeanor": pick(lewd, demeanors),
        "moan": pick(lewd, moans),
        "skillLevel": pick(exp, skills),
        "orgasm": pick(0.3 + lewd * 0.4 + youth * 0.2, orgasms),
        "feel": pick(lewd, feels),
        "persona": persona_of(pid, relation, job),
        "sellingPoints": points[:5],
        "hoursTag": hours,
        "dailyQuota": "一天一客" if ident != "自由职业" else "一天两客",
        "travel": "本地客人",
        "condom": condom,
        "reviewPref": "可以接受",
        "personality": personality,
        "job": job,
        "identity": ident,
        "marriage": marriage,
    }


def main() -> None:
    pop = {}
    with POP.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            pop[row["person_id"]] = row
    prof = {}
    with PROF.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            prof[row["person_id"]] = row
    homes = {}
    with HOMES.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("place_role") == "HOME":
                homes[row["person_id"]] = row["place_id"]

    def gender(pid: str) -> str:
        return pop.get(pid, {}).get("性别") or ""

    def age(pid: str) -> int:
        return int(pop.get(pid, {}).get("年龄") or 0)

    rels = []
    with REL.open(encoding="utf-8-sig") as f:
        rels = list(csv.DictReader(f))

    claimed: dict[str, tuple[str, str]] = {}  # woman -> (relation, owner_pid)

    def claim(wid: str, relation: str, owner: str) -> None:
        if wid in claimed:
            return
        if gender(wid) != "女" or age(wid) < 18:
            return
        if gender(owner) != "男" or age(owner) < 18:
            return
        claimed[wid] = (relation, owner)

    for row in rels:
        if row["relationship_type"] != "parent_of":
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        pa, ch = (a, b) if age(a) >= age(b) else (b, a)
        if gender(pa) == "女" and gender(ch) == "男" and age(pa) - age(ch) >= 16:
            claim(pa, "母亲", ch)
    for row in rels:
        if row["relationship_type"] != "spouse":
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        if {gender(a), gender(b)} != {"男", "女"}:
            continue
        w, m = (a, b) if gender(a) == "女" else (b, a)
        claim(w, "妻子", m)
    for row in rels:
        if row["relationship_type"] != "parent_of":
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        pa, ch = (a, b) if age(a) >= age(b) else (b, a)
        if gender(pa) == "男" and gender(ch) == "女" and age(ch) >= 18 and age(pa) - age(ch) >= 16:
            claim(ch, "女儿", pa)
    friends = []
    for row in rels:
        if row["relationship_type"] != "friend":
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        if {gender(a), gender(b)} != {"男", "女"}:
            continue
        friends.append((float(row.get("strength") or 0), a, b))
    friends.sort(reverse=True)
    for strength, a, b in friends:
        if strength < 0.55:
            continue
        w, m = (a, b) if gender(a) == "女" else (b, a)
        claim(w, "女友", m)
    for row in rels:
        if row["relationship_type"] != "sibling":
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        if {gender(a), gender(b)} != {"男", "女"}:
            continue
        w, m = (a, b) if gender(a) == "女" else (b, a)
        claim(w, "兄妹", m)
    for strength, a, b in friends:
        w, m = (a, b) if gender(a) == "女" else (b, a)
        claim(w, "朋友", m)
    for row in rels:
        if row["relationship_type"] != "coworker":
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        if {gender(a), gender(b)} != {"男", "女"}:
            continue
        w, m = (a, b) if gender(a) == "女" else (b, a)
        claim(w, "同事", m)
    for row in rels:
        if row["relationship_type"] not in ("neighbor", "housemate"):
            continue
        a, b = row["person_id_a"], row["person_id_b"]
        if {gender(a), gender(b)} != {"男", "女"}:
            continue
        w, m = (a, b) if gender(a) == "女" else (b, a)
        claim(w, "朋友", m)

    counts: dict[str, int] = defaultdict(int)
    for relation, _ in claimed.values():
        counts[relation] += 1

    needed_places = set()
    for pid, home in homes.items():
        needed_places.add(home)
    coords: dict[str, tuple[float, float]] = {}
    if PLACES.exists() and PLACES.stat().st_size > 1000:
        with PLACES.open(encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                pid = row.get("place_id")
                if pid in needed_places:
                    try:
                        coords[pid] = (float(row["lat"]), float(row["lng"]))
                    except (TypeError, ValueError):
                        pass

    owners: dict[str, dict] = {}
    for oid, o in pop.items():
        if gender(oid) != "男":
            continue
        owners[oid] = {
            "person_id": oid,
            "name": o["姓名"],
            "age": age(oid),
            "job": o.get("具体职位") or "",
            "email": f"{oid.lower()}@gta.xiangce.app",
        }

    stalls = []
    for wid, w in pop.items():
        if gender(wid) != "女" or age(wid) < 18:
            continue
        owned = claimed.get(wid)
        relation = owned[0] if owned else None
        oid = owned[1] if owned else None
        job, ident = job_of(w)
        pers = personality_of(prof.get(wid), w.get("家庭状态") or "")
        marriage = "未婚未育"
        if relation in ("母亲", "妻子") or ("孩子" in (w.get("家庭状态") or "") and "无" not in (w.get("家庭状态") or "")):
            marriage = "已婚已育"
        if relation in ("女儿", "兄妹") and age(wid) < 25:
            marriage = "未婚未育"
        body_h = 156 + int(h01(wid, "h") * 16)
        body_w = 44 + int(h01(wid, "w") * 16)
        cups = ["B", "C", "C", "D", "C"]
        cup = cups[int(h01(wid, "cup") * 5) % 5]
        li = listing(wid, age(wid), relation or "朋友", job, ident, pers, marriage)
        photo = PHOTOS[int(h01(wid, "img") * len(PHOTOS)) % len(PHOTOS)]
        home = homes.get(wid)
        latlng = coords.get(home or "", (43.8561, -79.3370))
        hour = 5 + ["入门基础级", "常规伴侣级", "优质情人级", "专业技师级"].index(li["skillLevel"]) * 3
        who = f"{oid}名下" if oid else "无主"
        stalls.append(
            {
                "person_id": wid,
                "owner_person_id": oid,
                "name": w["姓名"],
                "age": age(wid),
                "relation": relation,
                "heightCm": body_h,
                "weightKg": body_w,
                "cup": cup,
                "image": photo,
                "hourFen": hour * 100,
                "nightFen": hour * 400,
                "etaMin": 15 + int(h01(wid, "eta") * 20),
                "lat": latlng[0],
                "lng": latlng[1],
                "bio": f"{who}。{wid}。{age(wid)}岁{job}，性格{pers}。",
                **li,
            }
        )
        counts["unowned" if not oid else relation] += 0

    counts["unowned"] = sum(1 for s in stalls if not s["owner_person_id"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"owners": list(owners.values()), "stalls": stalls, "counts": dict(counts)}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print("wrote", OUT, "owners", len(owners), "stalls", len(stalls), dict(counts))
    pers_c = defaultdict(int)
    job_c = defaultdict(int)
    persona_c = defaultdict(int)
    for s in stalls:
        pers_c[s["personality"]] += 1
        job_c[s["job"]] += 1
        persona_c[s["persona"]] += 1
    print("personality", dict(pers_c))
    print("job", dict(job_c))
    print("persona", dict(persona_c))
    print("with coords", sum(1 for s in stalls if s["lat"] is not None), "unowned", counts["unowned"])


if __name__ == "__main__":
    main()
