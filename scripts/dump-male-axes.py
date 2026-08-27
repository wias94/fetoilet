#!/usr/bin/env python3
import csv
import json
from pathlib import Path

pop = {}
with open("/tmp/pop.csv", encoding="utf-8-sig", newline="") as f:
    for row in csv.DictReader(f):
        pop[row["person_id"]] = row
prof = {}
with open("/tmp/prof.csv", encoding="utf-8-sig", newline="") as f:
    for row in csv.DictReader(f):
        prof[row["person_id"]] = row

out = {}
for pid, p in pop.items():
    f = prof.get(pid) or {}
    def n(key):
        try:
            return float(f.get(key) or 0.5)
        except ValueError:
            return 0.5
    out[pid] = {
        "age": int(p.get("年龄") or 0),
        "gender": p.get("性别") or "",
        "job": p.get("具体职位") or "",
        "family_status": p.get("家庭状态") or "",
        "sociability": n("sociability"),
        "routine_preference": n("routine_preference"),
        "spontaneity": n("spontaneity"),
        "travel_tolerance": n("travel_tolerance"),
        "nightlife_preference": n("nightlife_preference"),
        "activity_budget": n("activity_budget"),
        "family_orientation": n("family_orientation"),
        "warmth": n("warmth"),
        "directness": n("directness"),
        "patience": n("patience"),
        "communication_style": f.get("communication_style") or "",
        "personality_summary": f.get("personality_summary") or "",
    }
Path("/tmp/person-axes.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print("wrote", len(out), "men", sum(1 for v in out.values() if v["gender"] == "男"))
