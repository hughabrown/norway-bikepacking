export const DEFAULT_VARIANT = "besseggen";
export const TRIP_TIMEZONE = "Europe/Oslo";

export interface TripStage {
  day: number;
  date: string;
  from: string;
  to: string;
  km: number;
  ascentM: number;
  surface: string;
  overnight: string;
  summary: string;
  highlights: string[];
  notes: string;
  startKm: number | null;
  endKm: number | null;
  kind: string;
  sideQuest: boolean;
  mapRef: string | null;
  mapView: [number, number, number] | null;
  via: string[];
}

export interface TripVariant {
  label: string;
  sub: string;
  dates: string;
  startKm: number;
  h1from: string;
  high: { m: number; name: string };
  stages: TripStage[];
}

export interface TripPlace {
  name: string;
  type?: string;
  category?: string;
  lat?: number;
  lng?: number;
  description?: string;
  price?: string;
  bookingNote?: string;
  detour?: string;
  nearStop?: string;
  town?: string;
  source?: string;
}

export interface TripTown {
  town: string;
  food?: TripPlace[];
  sleep?: TripPlace[];
  notes?: string;
}

export interface TripPoiGroup {
  pois: TripPlace[];
}

export interface Trip {
  name: string;
  url: string;
  totalKm: number;
  gain: number;
  variants: Record<string, TripVariant>;
  towns: TripTown[];
  poiGroups: TripPoiGroup[];
  logistics: Record<string, unknown>;
  officialLinks: string[];
}

export interface LookupItineraryDayInput {
  day: number;
  variant?: string;
}

export type LookupItineraryDayResult =
  | {
      ok: true;
      variant: string;
      variantLabel: string;
      day: number;
      stage: TripStage;
    }
  | {
      ok: false;
      error: string;
      validVariants: string[];
    };

export interface ResolveDateInput {
  currentDate: string;
  variant?: string;
}

export type ResolveDateResult =
  | {
      ok: true;
      variant: string;
      day: number;
      date: string;
    }
  | {
      ok: false;
      error: string;
      validDateRange: { start: string; end: string };
    };
