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


def norm_stage(s):
    return {
        "day": s["day"], "date": s.get("date", ""), "from": s.get("from", ""), "to": s.get("to", ""),
        "km": s.get("km", 0), "ascentM": s.get("ascentM", 0), "surface": s.get("surface", ""),
        "overnight": s.get("overnight", ""), "summary": s.get("summary", ""),
        "highlights": s.get("highlights", []), "notes": s.get("notes", ""),
        "startKm": s.get("startKm"), "endKm": s.get("endKm"),
        "kind": s.get("kind", "ride"), "sideQuest": bool(s.get("sideQuest", False)),
        "mapRef": s.get("mapRef"), "mapView": s.get("mapView"), "via": s.get("via", []),
    }


variants_built = {}
if override and override.get("variants"):
    for vkey, v in override["variants"].items():
        variants_built[vkey] = {
            "label": v["label"], "sub": v.get("sub", ""), "dates": v.get("dates", ""),
            "startKm": v.get("startKm", 0), "h1from": v.get("h1from", "Røros"),
            "high": v.get("high", {"m": 1322, "name": "Rallarvegen crest"}),
            "stages": [norm_stage(s) for s in v.get("stages", [])],
        }

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
# Override logistics (firmed-up dates: Dombås start, ferry + train ending)
ov_log = (override or {}).get("logistics", {})
if ov_log.get("gettingThere"):
    logistics["gettingThere"] = ov_log["gettingThere"]
if ov_log.get("gettingBack"):
    logistics["gettingBack"] = ov_log["gettingBack"]
    logistics.pop("bailouts", None)  # bail-out points no longer the story; ferry+train is fixed
extra = ov_log.get("extraNotes") or (override or {}).get("extraNotes") or []
if extra:
    logistics["practicalNotes"] = extra + logistics.get("practicalNotes", [])

# ---------------------------------------------------------------- assemble
# Fv51 line for the Besseggen variant: Vågåmo -> Sjodalen -> Gjendesheim ->
# Valdresflye pass -> Beitostølen. Approximate, traces the real road.
besseggen_spur = [
    [61.8745, 9.0985],   # Vågåmo
    [61.8090, 9.1450],   # Randsverk
    [61.7250, 9.0600],   # Lemonsjøen
    [61.6450, 8.9700],   # Maurvangen (Sjodalen)
    [61.5550, 8.8500],   # Bessheim
    [61.5050, 8.8150],   # near Gjende outlet
    [61.4937, 8.8035],   # Gjendesheim
    [61.4520, 8.8250],   # climb onto Valdresflye
    [61.4050, 8.8520],   # Valdresflye pass (~1389 m)
    [61.3560, 8.8650],   # Rjupa rest area
    [61.3050, 8.8950],   # descent
    [61.2470, 8.9130],   # Beitostølen
]

# Day 8 ferry Flåm -> Bergen, following the actual water: N up the
# Aurlandsfjord, W down the Sognefjord (calling Balestrand), out the mouth,
# then S through the coastal leads into Bergen.
ferry_line = [
    [60.8626, 7.1133],   # Flåm (head of Aurlandsfjord)
    [60.9080, 7.1820],   # Aurland (call)
    [60.9450, 7.0550],   # Aurlandsfjord heading NW
    [60.9680, 6.9450],   # junction with the Sognefjord (Frønningen)
    [61.0600, 6.7200],   # main Sognefjord, W
    [61.1980, 6.5350],   # Balestrand (call, north shore)
    [61.0900, 6.3300],   # back to the main channel
    [61.0850, 6.0400],
    [61.0750, 5.7600],   # fjord narrows toward the mouth (Rutledal)
    [61.0000, 5.4700],   # Sognefjord mouth, out to the coast
    [60.8400, 5.1500],   # S along the coast (Fensfjorden / Mongstad)
    [60.6400, 5.0100],   # outside Øygarden
    [60.4900, 5.0200],   # west of Sotra
    [60.4200, 5.2300],   # into Byfjorden from the NW
    [60.3950, 5.3240],   # Bergen
]

# Day 9 train Bergen -> Oslo on the Bergensbanen. Real passenger routing:
# Bergen hugs the fjords to Voss, crosses the Hardangervidda high section
# (Myrdal-Finse-Geilo), down Hallingdal to Hønefoss, then SW to Drammen and
# back up the Oslofjord to Oslo (NOT a straight Hønefoss->Oslo line).
train_line = [
    [60.3913, 5.3242],   # Bergen
    [60.4220, 5.4790],   # Arna
    [60.4470, 5.6200],   # Trengereid (Sørfjorden)
    [60.4830, 5.7400],   # Vaksdal
    [60.5900, 5.8150],   # Dale
    [60.6520, 5.9700],   # Bolstadøyri
    [60.6300, 6.4250],   # Voss
    [60.7340, 7.1230],   # Myrdal
    [60.6020, 7.5040],   # Finse (high point of the line, 1222 m)
    [60.5100, 7.8710],   # Haugastøl
    [60.5130, 8.0400],   # Ustaoset
    [60.5340, 8.2060],   # Geilo
    [60.6300, 8.5600],   # Ål
    [60.7000, 8.9490],   # Gol
    [60.5670, 9.1080],   # Nesbyen
    [60.4300, 9.4600],   # Flå (down Hallingdal)
    [60.1670, 10.2600],  # Hønefoss
    [59.9670, 10.0200],  # Vikersund (Randsfjord line, SW toward Drammen)
    [59.7750, 9.9100],   # Hokksund
    [59.7440, 10.2050],  # Drammen
    [59.8350, 10.4350],  # Asker (up the Oslofjord)
    [59.9110, 10.7520],  # Oslo S
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
    "ferryLine": ferry_line,
    "trainLine": train_line,
    "authorPois": rw["authorPois"],
    "variants": variants_built,
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
