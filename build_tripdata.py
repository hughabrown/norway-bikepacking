#!/usr/bin/env python3
"""Build tripdata.js for the Norway bikepacking site.

Inputs:
  rwgps_extract.json      - track/profile/author POIs from RideWithGPS route 41496641
  research_south.json     - optional: workflow output (Beitostolen..Flam towns, POIs, logistics)
  research_north.json     - optional: workflow output (Roros..Vinstre towns, POIs, north logistics)
  stages_override.json    - optional: hand-tuned stage tables (wins over the built-in draft)

Output: tripdata.js  (window-global TRIP object consumed by index.html)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, required=False):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        if required:
            sys.exit(f"missing required input: {name}")
        return None
    with open(path) as f:
        return json.load(f)


rw = load("rwgps_extract.json", required=True)
south = load("research_south.json")
north = load("research_north.json")
override = load("stages_override.json")
images = load("images.json") or {}
gimages = load("gimages.json") or {}

import re
import unicodedata


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")[:60]


def attach_image(place):
    slug = slugify(place.get("name", ""))
    grec = gimages.get(slug)
    if grec and grec.get("file"):
        place["img"] = "gimages/" + grec["file"]
        place["imgCredit"] = ("Photo: image search · area impression" if grec.get("area")
                              else "Photo: Google Maps")
        return
    rec = images.get(slug)
    if rec and rec.get("file"):
        place["img"] = "images/" + rec["file"]
        if rec.get("credit"):
            place["imgCredit"] = rec["credit"]

# ---------------------------------------------------------------- stages
# Draft plan derived from track kilometre marks; replaced by stages_override.json
# once research-informed numbers are in.
FULL_STAGES = [
    dict(day=1, date="2026-07-09", from_="Røros", to="Tufsingdalen", km=52, ascentM=700,
         surface="gravel, quiet roads", overnight="Tufsingdalen", startKm=0, endKm=52,
         summary="Morning train Oslo–Røros, a couple of hours in the UNESCO mining town, then roll south through Grådalen into the quiet Tufsingdalen valley.",
         highlights=["Røros old town and slag heaps", "Grådalen", "First shielings"],
         notes="Stock up in Røros: next proper grocery is Alvdal, ~110 km on."),
    dict(day=2, date="2026-07-10", from_="Tufsingdalen", to="Alvdal", km=111, ascentM=1500,
         surface="remote gravel, some rough sections", overnight="Alvdal", startKm=52, endKm=163,
         summary="The big wilderness day: Orvdalen, Storlægda and Rendalen, long climbs and descents, possible short hike-a-bike sections.",
         highlights=["Storlægda plateau", "Rendalen"], notes="Carry full food and water; no services until Alvdal."),
    dict(day=3, date="2026-07-11", from_="Alvdal", to="Grimsdalshytta", km=67, ascentM=1300,
         surface="gravel toll road", overnight="Grimsdalshytta", startKm=163, endKm=230,
         summary="Climb out of Østerdalen into Grimsdalen, the protected valley between Rondane and Dovrefjell.",
         highlights=["Grimsdalen toll road", "Rondane views"], notes=""),
    dict(day=4, date="2026-07-12", from_="Grimsdalshytta", to="Vågå", km=81, ascentM=1100,
         surface="gravel passes, short paved link at Dombås", overnight="Vågå", startKm=230, endKm=311,
         summary="Down to Dombås (decision point: the railway crosses here), then over the high Slådalsvegen to Vågå.",
         highlights=["Dombås", "Slådalsvegen viewpoints", "Vågå church"],
         notes="Sunday: most groceries shut. Plan food in advance or use open kiosks/petrol stations."),
    dict(day=5, date="2026-07-13", from_="Vågå", to="Haugseter (Vinstre)", km=74, ascentM=1300,
         surface="gravel, long climb", overnight="Haugseter", startKm=311, endKm=385,
         summary="Long climb out of the Gudbrandsdalen side valleys through Murudalen onto the Vinstre plateau with Jotunheimen filling the horizon.",
         highlights=["Murudalen", "Vinstre lakes", "Jotunheimen panorama"],
         notes="Last shop was Vågå; next is Beitostølen."),
    dict(day=6, date="2026-07-14", from_="Haugseter", to="Gjendesheim", km=48, ascentM=800,
         surface="gravel + paved Fv51 over Valdresflye", overnight="Gjendesheim", startKm=385, endKm=414,
         summary="Join Mjølkevegen at the Vinstre lakes, pass Bygdin, then the optional spur north over Valdresflye (1,389 m) to Gjendesheim at the foot of Besseggen.",
         highlights=["Bygdin", "Valdresflye", "Lake Gjende"], notes="Book the Gjende boat for tomorrow morning."),
    dict(day=7, date="2026-07-15", from_="Besseggen", to="ridge hike", km=0, ascentM=1100,
         surface="hike", overnight="Gjendesheim", startKm=414, endKm=414,
         summary="Boat to Memurubu, hike back over the Besseggen ridge between the green Gjende and blue Bessvatnet. Norway's most famous day hike.",
         highlights=["Gjende boat", "Besseggen ridge"], notes="6–8 h. Weather call: skip and ride on if it's filthy."),
    dict(day=8, date="2026-07-16", from_="Gjendesheim", to="Vaset", km=83, ascentM=1100,
         surface="paved Fv51, then Mjølkevegen gravel", overnight="Vaset", startKm=414, endKm=478,
         summary="Back over Valdresflye to Beitostølen, then Mjølkevegen proper over Slettefjell (1,236 m) and the summer-farm country to Vaset.",
         highlights=["Slettefjell", "Summer farms (stølar)"], notes=""),
    dict(day=9, date="2026-07-17", from_="Vaset", to="Gol", km=70, ascentM=700,
         surface="gravel over Stølsvidda, descent to Hallingdal", overnight="Gol", startKm=478, endKm=548,
         summary="Across the Stølsvidda plateau and a long descent into Hallingdal.",
         highlights=["Stølsvidda", "Hallingdal descent"], notes=""),
    dict(day=10, date="2026-07-18", from_="Gol", to="Geilo", km=53, ascentM=900,
         surface="valley roads and gravel", overnight="Geilo", startKm=548, endKm=600,
         summary="Up the Hallingdal valley, past Torpo stave church, to the mountain town of Geilo under Hallingskarvet.",
         highlights=["Torpo stave church", "Hallingskarvet views"], notes=""),
    dict(day=11, date="2026-07-19", from_="Geilo", to="Finse", km=52, ascentM=900,
         surface="Rallarvegen gravel", overnight="Finse", startKm=600, endKm=652,
         summary="Onto the Rallarvegen at Haugastøl and up along the Bergen line to car-free Finse, the highest station in Norway, under the Hardangerjøkulen glacier.",
         highlights=["Rallarvegen", "Finse 1222", "Hardangerjøkulen"], notes=""),
    dict(day=12, date="2026-07-20", from_="Finse", to="Flåm", km=54, ascentM=400,
         surface="Rallarvegen gravel, steep switchback descent", overnight="Flåm", startKm=652, endKm=705.6,
         summary="Over the route's high point (1,322 m), past Fagernut's waffles, then the 21 hairpins of Myrdalsberget and the green Flåm valley down to the fjord.",
         highlights=["Fagernut waffle cabin", "Kjosfossen", "Myrdal switchbacks", "Aurlandsfjord"], notes=""),
]

SHORT_STAGES = [
    dict(day=1, date="2026-07-09", from_="Dombås", to="Vågå", km=48, ascentM=900,
         surface="gravel pass (Slådalsvegen)", overnight="Vaga", startKm=263.7, endKm=311,
         summary="Morning train Oslo–Dombås, then straight over the high Slådalsvegen to Vågå.",
         highlights=["Slådalsvegen viewpoints", "Vågå church"], notes="Buy dinner + breakfast in Dombås before leaving."),
    dict(day=2, date="2026-07-10", from_="Vågå", to="Haugseter (Vinstre)", km=74, ascentM=1300,
         surface="gravel, long climb", overnight="Haugseter", startKm=311, endKm=385,
         summary="Long climb through Murudalen onto the Vinstre plateau with Jotunheimen ahead.",
         highlights=["Murudalen", "Vinstre lakes", "Jotunheimen panorama"], notes="Last shop was Vågå; next is Beitostølen."),
    dict(day=3, date="2026-07-11", from_="Haugseter", to="Gjendesheim", km=48, ascentM=800,
         surface="gravel + paved Fv51 over Valdresflye", overnight="Gjendesheim", startKm=385, endKm=414,
         summary="Join Mjølkevegen, pass Bygdin, then the spur over Valdresflye (1,389 m) to Gjendesheim.",
         highlights=["Bygdin", "Valdresflye", "Lake Gjende"], notes="Book the Gjende boat for tomorrow morning."),
    dict(day=4, date="2026-07-12", from_="Besseggen", to="ridge hike", km=0, ascentM=1100,
         surface="hike", overnight="Gjendesheim", startKm=414, endKm=414,
         summary="Boat to Memurubu, hike back over the Besseggen ridge. Norway's most famous day hike.",
         highlights=["Gjende boat", "Besseggen ridge"], notes="6–8 h. Weather call: skip and ride on if it's filthy."),
    dict(day=5, date="2026-07-13", from_="Gjendesheim", to="Vaset", km=83, ascentM=1100,
         surface="paved Fv51, then Mjølkevegen gravel", overnight="Vaset", startKm=414, endKm=478,
         summary="Back over Valdresflye to Beitostølen, then Mjølkevegen over Slettefjell (1,236 m) to Vaset.",
         highlights=["Slettefjell", "Summer farms (stølar)"], notes=""),
    dict(day=6, date="2026-07-14", from_="Vaset", to="Gol", km=70, ascentM=700,
         surface="gravel over Stølsvidda, descent to Hallingdal", overnight="Gol", startKm=478, endKm=548,
         summary="Across the Stølsvidda plateau and a long descent into Hallingdal.",
         highlights=["Stølsvidda", "Hallingdal descent"], notes=""),
    dict(day=7, date="2026-07-15", from_="Gol", to="Geilo", km=53, ascentM=900,
         surface="valley roads and gravel", overnight="Geilo", startKm=548, endKm=600,
         summary="Up the Hallingdal valley, past Torpo stave church, to Geilo under Hallingskarvet.",
         highlights=["Torpo stave church", "Hallingskarvet views"], notes=""),
    dict(day=8, date="2026-07-16", from_="Geilo", to="Finse", km=52, ascentM=900,
         surface="Rallarvegen gravel", overnight="Finse", startKm=600, endKm=652,
         summary="Onto the Rallarvegen at Haugastøl, up the Bergen line to car-free Finse under the Hardangerjøkulen glacier.",
         highlights=["Rallarvegen", "Finse 1222", "Hardangerjøkulen"], notes=""),
    dict(day=9, date="2026-07-17", from_="Finse", to="Flåm", km=54, ascentM=400,
         surface="Rallarvegen gravel, steep switchback descent", overnight="Flåm", startKm=652, endKm=705.6,
         summary="Over the high point (1,322 m), Fagernut waffles, the 21 hairpins of Myrdalsberget, and down the Flåm valley to the fjord.",
         highlights=["Fagernut waffle cabin", "Kjosfossen", "Myrdal switchbacks", "Aurlandsfjord"], notes=""),
]


def stage_out(s):
    return {
        "day": s["day"], "date": s["date"], "from": s["from_"] if "from_" in s else s["from"],
        "to": s["to"], "km": s["km"], "ascentM": s["ascentM"], "surface": s["surface"],
        "overnight": s["overnight"], "summary": s["summary"], "highlights": s.get("highlights", []),
        "notes": s.get("notes", ""), "startKm": s["startKm"], "endKm": s["endKm"],
    }


full_stages = [stage_out(s) for s in FULL_STAGES]
short_stages = [stage_out(s) for s in SHORT_STAGES]
if override:
    if override.get("full"):
        full_stages = override["full"]
    if override.get("short"):
        short_stages = override["short"]

# ---------------------------------------------------------------- research merge
# Long workflow stop labels -> canonical town keys the site matches on.
TOWN_RENAME = {
    "DNT Ellefsplass, Oversjodalen": "Oversjodalen",
    "Gjelten Bru Camping, Alvdal": "Alvdal",
    "Grimsdalshytta DNT staffed hut": "Grimsdalshytta",
    "Smedsmo Camping, Vaga": "Vaga",
    "Haugseter Fjellstue, Vinstre": "Haugseter",
}
TOWN_DROP = {"skabu"}  # Vinstra approach was replaced by the Roros route

towns, poi_groups = [], []
seen_towns = set()
for blob in (south, north):
    if not blob:
        continue
    for t in blob.get("towns", []):
        t["town"] = TOWN_RENAME.get(t.get("town", ""), t.get("town", ""))
        key = (t.get("town") or "").lower()
        if key and key not in seen_towns and key not in TOWN_DROP:
            seen_towns.add(key)
            towns.append(t)
    for g in blob.get("poiGroups", []):
        poi_groups.append(g)

# drop POIs that are the same place under reshuffled names (e.g.
# "Aukrustsenteret (Huset Aukrust)" vs "Huset Aukrust (Aukrustsenteret)")
seen_poi_keys = set()
for g in poi_groups:
    kept = []
    for p in g.get("pois", []):
        key = "-".join(sorted(slugify(p.get("name", "")).split("-")))
        if key in seen_poi_keys:
            continue
        seen_poi_keys.add(key)
        kept.append(p)
    g["pois"] = kept

for t in towns:
    for f in t.get("food", []):
        attach_image(f)
    for s in t.get("sleep", []):
        attach_image(s)
for g in poi_groups:
    for p in g.get("pois", []):
        attach_image(p)

logistics = {}
if south and south.get("logistics"):
    sl = south["logistics"]
    # gettingThere from the south workflow targets Vinstra and no longer applies
    for k in ("gettingBack", "bikeOnTrains", "julyConditions", "rallarvegen"):
        if sl.get(k):
            logistics[k] = sl[k]
    logistics["practicalNotes"] = list(sl.get("practicalNotes", []))
if north and north.get("logisticsNorth"):
    ln = north["logisticsNorth"]
    if ln.get("gettingThere"):
        logistics["gettingThere"] = ln["gettingThere"]
    if ln.get("bailouts"):
        logistics["bailouts"] = ln["bailouts"]
    logistics["practicalNotes"] = logistics.get("practicalNotes", []) + ln.get("practicalNotes", [])
if override and override.get("extraNotes"):
    logistics["practicalNotes"] = logistics.get("practicalNotes", []) + override["extraNotes"]

# ---------------------------------------------------------------- assemble
besseggen_spur = [
    [61.4937, 8.8035], [61.4795, 8.8060], [61.4632, 8.8042], [61.4435, 8.7964],
    [61.4247, 8.7869], [61.4095, 8.7831], [61.3909, 8.7920], [61.3756, 8.7894],
    [61.3610, 8.7821], [61.3489, 8.7806], [61.3357, 8.7930],  # Gjendesheim -> Bygdin
    [61.3199, 8.8233], [61.3001, 8.8503], [61.2806, 8.8678], [61.2624, 8.8870],
    [61.2470, 8.9130],  # Bygdin -> Beitostolen
]

profile_labels = [
    {"km": 0, "ele": 622, "label": "Røros"},
    {"km": 241, "ele": 1164, "label": "Grimsdalen"},
    {"km": 288, "ele": 1156, "label": "Slådalsvegen"},
    {"km": 389, "ele": 1169, "label": "Vinstre"},
    {"km": 444, "ele": 1236, "label": "Slettefjell"},
    {"km": 548, "ele": 226, "label": "Gol"},
    {"km": 660, "ele": 1301, "label": "Rallarvegen"},
    {"km": 705, "ele": 1, "label": "Flåm"},
]

import hashlib as _h
_sig = _h.md5()
for d in ("gimages", "images"):
    dp = os.path.join(HERE, d)
    if os.path.isdir(dp):
        for fn in sorted(os.listdir(dp)):
            _sig.update(f"{fn}:{os.path.getsize(os.path.join(dp, fn))};".encode())
img_version = _sig.hexdigest()[:8]

trip = {
    "imgV": img_version,
    "name": rw["name"],
    "url": rw["url"],
    "totalKm": rw["totalKm"],
    "gain": rw["gain"],
    "maxEle": 1322,
    "maxEleName": "Rallarvegen crest",
    "dombasKm": 263.7,
    "track": rw["track"],
    "profile": rw["profile"],
    "profileLabels": profile_labels,
    "besseggenSpur": besseggen_spur,
    "authorPois": rw["authorPois"],
    "variants": {
        "full": {
            "label": "Full · Røros start", "sub": "706 km · 12 days · 9 → 20 July",
            "dates": "thu 9 – mon 20 july", "startKm": 0, "h1from": "Røros",
            "stages": full_stages,
        },
        "short": {
            "label": "Short · Dombås start", "sub": "≈ 480 km · 9 days · 9 → 17 July",
            "dates": "thu 9 – fri 17 july", "startKm": 263.7, "h1from": "Dombås",
            "stages": short_stages,
        },
    },
    "stopOrder": ["Roros", "Tufsingdalen", "Oversjodalen", "Rendalen", "Alvdal",
                   "Grimsdalshytta", "Dombas", "Vaga", "Haugseter", "Gjendesheim",
                   "Beitostolen", "Vaset", "Gol", "Geilo", "Haugastol", "Finse", "Flam"],
    "towns": towns,
    "poiGroups": poi_groups,
    "logistics": logistics,
    "officialLinks": ((south or {}).get("route") or {}).get("officialLinks", []),
}

out = os.path.join(HERE, "tripdata.js")
with open(out, "w") as f:
    f.write("// generated by build_tripdata.py — do not edit by hand\n")
    f.write("var TRIP = ")
    json.dump(trip, f, ensure_ascii=False)
    f.write(";\n")

size = os.path.getsize(out)

# Stamp a content-hash version onto the script tag so browsers (and GitHub
# Pages caches) pick up new data immediately.
import hashlib
import re
ver = hashlib.md5(open(out, "rb").read()).hexdigest()[:8]
idx_path = os.path.join(HERE, "index.html")
idx = open(idx_path).read()
idx_new = re.sub(r'src="tripdata\.js(\?v=[0-9a-f]*)?"', f'src="tripdata.js?v={ver}"', idx)
if idx_new != idx:
    open(idx_path, "w").write(idx_new)

print(f"wrote {out} ({size/1024:.0f} KB, v={ver}) — towns: {len(towns)}, poi groups: {len(poi_groups)}, "
      f"logistics keys: {sorted(logistics)}")
