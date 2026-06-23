import { getTrip, getVariantKey, getValidVariants, lookupItineraryDay } from "./trip-data";
import type {
  PlaceCategory,
  RankedTripPlace,
  SearchTripPlacesInput,
  SearchTripPlacesResult,
  TripPlace,
  TripStage,
  TripTown,
} from "./types";

function normalize(value: string): string {
  return value
    .replace(/[øØ]/g, "o")
    .replace(/[åÅ]/g, "a")
    .replace(/[æÆ]/g, "ae")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeCategory(source: TripPlace, bucket: "food" | "sleep" | "poi"): PlaceCategory {
  const type = normalize(source.type ?? source.category ?? "");
  if (
    bucket === "sleep" ||
    ["hotel", "campsite", "freecamp", "hut", "lodging"].some((term) => type.includes(term))
  )
    return "sleep";
  if (["grocery", "supermarket", "market", "resupply"].some((term) => type.includes(term))) return "resupply";
  if (
    bucket === "food" ||
    ["cafe", "bakery", "restaurant", "pub", "food"].some((term) => type.includes(term))
  )
    return "eat";
  return "sight";
}

function googleMapsUrl(place: TripPlace): string | undefined {
  if (typeof place.lat === "number" && typeof place.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  if (place.name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Norway`)}`;
  }
  return undefined;
}

function stageHaystack(stage: TripStage): string {
  return normalize([
    stage.from,
    stage.to,
    stage.overnight,
    stage.summary,
    stage.notes,
    ...stage.highlights,
    ...stage.via,
  ].join(" "));
}

function stageStopNames(stage: TripStage, towns: TripTown[]): string[] {
  const haystack = stageHaystack(stage);
  const names = new Set<string>([stage.from, stage.to, stage.overnight, ...stage.via].filter(Boolean));
  for (const town of towns) {
    const key = normalize(town.town);
    if (key && haystack.includes(key)) {
      names.add(town.town);
    }
  }
  return [...names];
}

function toRanked(place: TripPlace, category: PlaceCategory, near: string, uncertaintyNotes: string[]): RankedTripPlace {
  return {
    name: place.name,
    category,
    type: place.type ?? place.category ?? category,
    near,
    description: place.description ?? "",
    price: place.price,
    coordinates: typeof place.lat === "number" && typeof place.lng === "number" ? { lat: place.lat, lng: place.lng } : undefined,
    googleMapsUrl: googleMapsUrl(place),
    confidence: near ? "high" : "medium",
    uncertaintyNotes,
  };
}

function scorePlace(place: RankedTripPlace, input: SearchTripPlacesInput, stopKeys: Set<string>): number {
  let score = 0;
  const name = normalize(place.name);
  const description = normalize(place.description);
  const near = normalize(place.near);
  if (stopKeys.has(near)) score += 50;
  if (input.near && near.includes(normalize(input.near))) score += 50;
  if (input.category && place.category === input.category) score += 40;
  if (input.category === "eat" && place.category === "resupply") score += 18;
  if (input.need) {
    for (const token of normalize(input.need).split(" ").filter(Boolean)) {
      if (name.includes(token)) score += 8;
      if (description.includes(token)) score += 5;
    }
  }
  if (name.includes("spar")) score += 6;
  if (name.includes("jotunstogo")) score += 6;
  return score;
}

export function searchTripPlaces(input: SearchTripPlacesInput): SearchTripPlacesResult {
  const trip = getTrip();
  const requestedVariant = input.variant?.trim();
  const validVariants = getValidVariants();
  if (requestedVariant && !trip.variants[requestedVariant]) {
    return { ok: false, error: `Unknown variant: ${requestedVariant}`, validVariants };
  }
  const variant = getVariantKey(requestedVariant);
  const stageResult =
    typeof input.day === "number"
      ? requestedVariant
        ? lookupItineraryDay({ day: input.day, variant: requestedVariant })
        : lookupItineraryDay({ day: input.day })
      : undefined;
  if (stageResult && !stageResult.ok) {
    return { ok: false, error: stageResult.error, validVariants: stageResult.validVariants };
  }

  const stopNames = stageResult?.ok ? stageStopNames(stageResult.stage, trip.towns) : input.near ? [input.near] : [];
  const stopKeys = new Set(stopNames.map(normalize));
  const requestedNear = normalize(input.near ?? "");
  const places: RankedTripPlace[] = [];

  for (const town of trip.towns) {
    const townKey = normalize(town.town);
    const matchesStop = stopKeys.size === 0 || stopKeys.has(townKey) || (requestedNear && townKey.includes(requestedNear));
    if (!matchesStop) continue;

    for (const food of town.food ?? []) {
      places.push(
        toRanked(food, placeCategory(food, "food"), town.town, [
          "Opening hours can change; verify same-day before relying on this stop.",
        ]),
      );
    }
    for (const sleep of town.sleep ?? []) {
      places.push(toRanked(sleep, "sleep", town.town, ["Availability changes quickly in July; book or call before committing."]));
    }
  }

  for (const group of trip.poiGroups) {
    for (const poi of group.pois) {
      const near = poi.nearStop ?? "";
      const nearKey = normalize(near);
      const matchesStop = stopKeys.size === 0 || stopKeys.has(nearKey) || (requestedNear && nearKey.includes(requestedNear));
      if (!matchesStop) continue;
      places.push(
        toRanked(
          poi,
          placeCategory(poi, "poi"),
          near,
          ["Treat detour time and operating details as planning notes; verify live conditions."],
        ),
      );
    }
  }

  const scored = places
    .filter((place) => !input.category || place.category === input.category || (input.category === "eat" && place.category === "resupply"))
    .map((place) => ({ place, score: scorePlace(place, input, stopKeys) }))
    .filter((entry) => entry.score > 0 || !input.day)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));

  const limit = input.limit ?? 8;
  const shouldPromoteResupply =
    input.category === "eat" && normalize(input.need ?? "").split(" ").includes("lunch");

  const ranked = shouldPromoteResupply
    ? (() => {
        const top = scored.slice(0, limit);
        if (top.some((entry) => entry.place.category === "resupply")) return top.slice(0, limit);

        const resupplyEntry = scored.find((entry) => entry.place.category === "resupply");
        if (!resupplyEntry) return top;

        if (top.length >= limit) {
          const replacedTop = top.slice(0, limit - 1);
          return [...replacedTop, resupplyEntry];
        }

        return [...top, resupplyEntry];
      })()
    : scored.slice(0, limit);

  const placeResults = ranked.map((entry) => entry.place);

  return {
    ok: true,
    variant,
    day: input.day,
    query: input,
    places: placeResults,
  };
}
