# Røros → Flåm · Setrer og villmark · July 2026

Trip-planning site for a bikepacking ride across Norway: Røros over the
Rondane/Dovre wilderness onto Mjølkevegen's summer-farm country, then the
Rallarvegen down to the Aurlandsfjord. Two variants (12-day full from Røros,
9-day short from Dombås), day-by-day stages, an interactive map with the
actual GPS track, and researched food, sleep and sightseeing stops.

- `index.html` — the site (static, no build step)
- `tripdata.js` — generated data: track, stages, places, logistics
- `build_tripdata.py` — regenerates `tripdata.js` from the inputs below
- `rwgps_extract.json` — track/profile/POIs from RideWithGPS route 41496641
- `research_south.json` / `research_north.json` — researched stops and logistics
- `stages_override.json` — the hand-tuned stage tables
- `export_places.py` → `saved_places.csv` / `saved_places.kml` — Google My Maps import
