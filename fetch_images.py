#!/usr/bin/env python3
"""Fetch place photos (freely licensed) into images/, v2.

Rules:
  - sights: no.wikipedia -> en.wikipedia -> Commons file-name search ->
            Commons geosearch (400 m) -> Openverse (CC search), in order
  - businesses (food/sleep): NAME-matched sources only (Commons file search,
            Openverse). No geo matching - it returns the nearest landmark,
            not the business.
  - a photo is used at most once across the whole site (global dedupe)
  - no photo beats a wrong photo: fall back to the styled placeholder
Writes images/<slug>.<ext> (≈480 px) and images.json with credits.
"""
import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "images")
os.makedirs(IMG_DIR, exist_ok=True)
UA = {"User-Agent": "NorwayTripSite/1.0 (personal bikepacking trip planner; hugh.brown399@gmail.com)"}
THUMB = 480
used = set()  # basenames of source files already assigned to a place


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


def words(s):
    return {w for w in re.findall(r"[a-zæøåäöA-ZÆØÅÄÖ]{4,}", s.lower())}


def src_key(url):
    # identity of the underlying photo, robust to thumb-size prefixes
    base = urllib.parse.unquote(url.split("/")[-1])
    return re.sub(r"^\d+px-", "", base).lower()


def fmt_credit(artist, lic, via):
    bits = [b for b in (strip_html(artist)[:60], lic) if b]
    return "Photo: " + (" · ".join(bits) + " · " if bits else "") + via


def commons_meta_credit(file_title):
    try:
        d = api("https://commons.wikimedia.org/w/api.php", {
            "action": "query", "format": "json", "titles": file_title,
            "prop": "imageinfo", "iiprop": "extmetadata",
            "iiextmetadatafilter": "Artist|LicenseShortName"})
        info = next(iter(d["query"]["pages"].values())).get("imageinfo", [{}])[0].get("extmetadata", {})
        return fmt_credit(info.get("Artist", {}).get("value", ""),
                          info.get("LicenseShortName", {}).get("value", ""), "Wikimedia")
    except Exception:
        return "Photo: Wikimedia Commons"


def wiki_pageimage(lang, query):
    try:
        d = api(f"https://{lang}.wikipedia.org/w/api.php", {
            "action": "query", "format": "json", "list": "search",
            "srsearch": query, "srlimit": 1, "srnamespace": 0})
        hits = d.get("query", {}).get("search", [])
        if not hits or not (words(query) & words(hits[0]["title"])):
            return None
        d = api(f"https://{lang}.wikipedia.org/w/api.php", {
            "action": "query", "format": "json", "titles": hits[0]["title"],
            "prop": "pageimages", "piprop": "thumbnail|name", "pithumbsize": THUMB})
        page = next(iter(d["query"]["pages"].values()))
        thumb = page.get("thumbnail", {}).get("source")
        if not thumb or src_key(thumb) in used:
            return None
        credit = commons_meta_credit("File:" + page["pageimage"]) if page.get("pageimage") else "Photo: Wikipedia"
        return {"url": thumb, "credit": credit}
    except Exception:
        return None


def commons_candidates(params):
    """Run a commons query that yields pages with imageinfo; return candidates."""
    out = []
    try:
        d = api("https://commons.wikimedia.org/w/api.php", params)
        pages = d.get("query", {}).get("pages", {})
        for p in sorted(pages.values(), key=lambda p: p.get("index", 9)):
            ii = p.get("imageinfo", [{}])[0]
            url = ii.get("thumburl") or ii.get("url")
            if not url or not re.search(r"\.(jpe?g|png)$", url, re.I):
                continue
            meta = ii.get("extmetadata", {})
            out.append({
                "url": url, "title": p.get("title", ""),
                "credit": fmt_credit(meta.get("Artist", {}).get("value", ""),
                                     meta.get("LicenseShortName", {}).get("value", ""), "Wikimedia")})
    except Exception:
        pass
    return out


def commons_name_search(query):
    cands = commons_candidates({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": query, "gsrnamespace": 6, "gsrlimit": 6,
        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": THUMB,
        "iiextmetadatafilter": "Artist|LicenseShortName"})
    q = words(query)
    for c in cands:
        if src_key(c["url"]) in used:
            continue
        if q & words(c["title"]):
            return c
    return None


def commons_geo(lat, lng, radius):
    cands = commons_candidates({
        "action": "query", "format": "json", "generator": "geosearch",
        "ggscoord": f"{lat}|{lng}", "ggsradius": radius, "ggslimit": 6,
        "ggsnamespace": 6, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": THUMB,
        "iiextmetadatafilter": "Artist|LicenseShortName"})
    for c in cands:
        if src_key(c["url"]) not in used:
            return c
    return None


def openverse(query):
    try:
        d = api("https://api.openverse.org/v1/images/", {
            "q": query + " Norway", "page_size": 10,
            "license": "by,by-sa,cc0,pdm"})
        q = words(query)
        for r in d.get("results", []):
            url = r.get("thumbnail") or r.get("url")
            if not url or src_key(r.get("url") or url) in used:
                continue
            title = r.get("title") or ""
            if not (q & words(title)):
                continue
            lic = ("CC " + r["license"].upper() if r.get("license") not in (None, "cc0", "pdm")
                   else (r.get("license") or "").upper())
            return {"url": url, "credit": fmt_credit(r.get("creator", ""), lic, "Openverse"),
                    "src_id": r.get("url") or url}
    except Exception:
        pass
    return None


def download(url, slug):
    ext = ".jpg"
    m = re.search(r"\.(jpe?g|png)", url, re.I)
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
    return re.sub(r"\s+", " ", q).strip(" -&,")


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

    out = {}
    for p in places:
        slug = slugify(p["name"])
        if not slug or slug in out:
            continue
        q = clean_query(p["name"])
        found = None
        if p["kind"] == "sight":
            found = (wiki_pageimage("no", q) or wiki_pageimage("en", q)
                     or commons_name_search(q)
                     or (commons_geo(p["lat"], p["lng"], 400) if p.get("lat") else None)
                     or openverse(q))
        else:
            found = commons_name_search(q) or openverse(q)
        rec = {"file": None, "credit": None}
        if found:
            try:
                fname = download(found["url"], slug)
                if fname:
                    used.add(src_key(found.get("src_id") or found["url"]))
                    rec = {"file": fname, "credit": found["credit"]}
            except Exception:
                pass
        out[slug] = rec
        print(f"{slug}: {'OK ' + rec['file'] if rec['file'] else 'none'}", flush=True)
        json.dump(out, open(os.path.join(HERE, "images.json"), "w"), ensure_ascii=False, indent=0)
        time.sleep(0.25)

    have = sum(1 for r in out.values() if r.get("file"))
    print(f"finished: {have}/{len(out)} places have an image", flush=True)


if __name__ == "__main__":
    main()
