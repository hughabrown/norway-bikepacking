#!/usr/bin/env python3
"""Fetch place photos from Wikipedia / Wikimedia Commons into images/.

Strategy per place:
  sights  -> no.wikipedia search -> en.wikipedia search -> Commons geosearch (400 m)
  eat/sleep -> Commons geosearch only (120 m), name search would mis-match brands
Writes images/<slug>.<ext> (480 px thumbs) and images.json with credits.
Resume-safe: skips slugs already in images.json.
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "images")
os.makedirs(IMG_DIR, exist_ok=True)
UA = {"User-Agent": "NorwayTripSite/1.0 (personal bikepacking trip planner; hugh.brown399@gmail.com)"}
THUMB = 480


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")[:60]


def api(url, params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(url + "?" + qs, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def commons_credit(file_title):
    try:
        d = api("https://commons.wikimedia.org/w/api.php", {
            "action": "query", "format": "json", "titles": file_title,
            "prop": "imageinfo", "iiprop": "extmetadata", "iiextmetadatafilter": "Artist|LicenseShortName"})
        pages = d["query"]["pages"]
        info = next(iter(pages.values())).get("imageinfo", [{}])[0].get("extmetadata", {})
        artist = strip_html(info.get("Artist", {}).get("value", ""))[:60]
        lic = info.get("LicenseShortName", {}).get("value", "")
        bits = [b for b in (artist, lic) if b]
        return ("Photo: " + " · ".join(bits) + " · Wikimedia") if bits else "Photo: Wikimedia Commons"
    except Exception:
        return "Photo: Wikimedia Commons"


def wiki_pageimage(lang, query, must_overlap):
    try:
        d = api(f"https://{lang}.wikipedia.org/w/api.php", {
            "action": "query", "format": "json", "list": "search",
            "srsearch": query, "srlimit": 1, "srnamespace": 0})
        hits = d.get("query", {}).get("search", [])
        if not hits:
            return None
        title = hits[0]["title"]
        if must_overlap:
            qwords = {w for w in re.findall(r"[a-zæøåA-ZÆØÅ]{4,}", query.lower())}
            twords = {w for w in re.findall(r"[a-zæøåA-ZÆØÅ]{4,}", title.lower())}
            if not (qwords & twords):
                return None
        d = api(f"https://{lang}.wikipedia.org/w/api.php", {
            "action": "query", "format": "json", "titles": title,
            "prop": "pageimages", "piprop": "thumbnail|name", "pithumbsize": THUMB})
        page = next(iter(d["query"]["pages"].values()))
        thumb = page.get("thumbnail", {}).get("source")
        pi_name = page.get("pageimage")
        if not thumb:
            return None
        credit = commons_credit("File:" + pi_name) if pi_name else "Photo: Wikipedia"
        return {"url": thumb, "credit": credit, "src": f"{lang}.wikipedia · {title}"}
    except Exception:
        return None


def commons_geo(lat, lng, radius):
    try:
        d = api("https://commons.wikimedia.org/w/api.php", {
            "action": "query", "format": "json", "generator": "geosearch",
            "ggscoord": f"{lat}|{lng}", "ggsradius": radius, "ggslimit": 5,
            "ggsnamespace": 6, "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": THUMB,
            "iiextmetadatafilter": "Artist|LicenseShortName"})
        pages = d.get("query", {}).get("pages", {})
        for p in sorted(pages.values(), key=lambda p: p.get("index", 9)):
            ii = p.get("imageinfo", [{}])[0]
            url = ii.get("thumburl") or ii.get("url")
            if not url or not re.search(r"\.(jpe?g|png)$", url, re.I):
                continue
            meta = ii.get("extmetadata", {})
            artist = strip_html(meta.get("Artist", {}).get("value", ""))[:60]
            lic = meta.get("LicenseShortName", {}).get("value", "")
            bits = [b for b in (artist, lic) if b]
            credit = ("Photo: " + " · ".join(bits) + " · Wikimedia") if bits else "Photo: Wikimedia Commons"
            return {"url": url, "credit": credit, "src": "commons geosearch"}
        return None
    except Exception:
        return None


def download(url, slug):
    ext = ".jpg"
    m = re.search(r"\.(jpe?g|png)$", url, re.I)
    if m:
        ext = "." + m.group(1).lower().replace("jpeg", "jpg")
    path = os.path.join(IMG_DIR, slug + ext)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
        f.write(r.read())
    if os.path.getsize(path) < 2000:
        os.remove(path)
        return None
    return os.path.basename(path)


def clean_query(name):
    q = re.sub(r"\([^)]*\)", "", name)
    q = re.sub(r"\s+", " ", q).strip(" -&,")
    return q


def main():
    raw = open(os.path.join(HERE, "tripdata.js")).read()
    trip = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])

    places = []
    for g in trip.get("poiGroups", []):
        for p in g.get("pois", []):
            places.append({"name": p["name"], "lat": p.get("lat"), "lng": p.get("lng"), "kind": "sight"})
    for t in trip.get("towns", []):
        for f in t.get("food", []):
            places.append({"name": f["name"], "lat": f.get("lat"), "lng": f.get("lng"), "kind": "biz"})
        for s in t.get("sleep", []):
            places.append({"name": s["name"], "lat": s.get("lat"), "lng": s.get("lng"), "kind": "biz"})

    out_path = os.path.join(HERE, "images.json")
    out = {}
    if os.path.exists(out_path):
        out = json.load(open(out_path))

    done = 0
    for p in places:
        slug = slugify(p["name"])
        if not slug or slug in out:
            continue
        found = None
        q = clean_query(p["name"])
        if p["kind"] == "sight":
            found = wiki_pageimage("no", q, True) or wiki_pageimage("en", q, True)
            if not found and p.get("lat"):
                found = commons_geo(p["lat"], p["lng"], 400)
        else:
            if p.get("lat"):
                found = commons_geo(p["lat"], p["lng"], 120)
        rec = {"file": None, "credit": None}
        if found:
            try:
                fname = download(found["url"], slug)
                if fname:
                    rec = {"file": fname, "credit": found["credit"], "src": found.get("src", "")}
            except Exception:
                pass
        out[slug] = rec
        done += 1
        print(f"{slug}: {'OK ' + rec['file'] if rec['file'] else 'none'}", flush=True)
        json.dump(out, open(out_path, "w"), ensure_ascii=False, indent=0)
        time.sleep(0.25)

    have = sum(1 for r in out.values() if r.get("file"))
    print(f"finished: {have}/{len(out)} places have an image", flush=True)


if __name__ == "__main__":
    main()
