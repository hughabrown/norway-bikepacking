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

export type PlaceCategory = "eat" | "sleep" | "resupply" | "sight";

export interface SearchTripPlacesInput {
  day?: number;
  variant?: string;
  near?: string;
  category?: PlaceCategory;
  need?: string;
  limit?: number;
}

export interface RankedTripPlace {
  name: string;
  category: PlaceCategory;
  type: string;
  near: string;
  description: string;
  price: string | undefined;
  coordinates: { lat: number; lng: number } | undefined;
  googleMapsUrl: string | undefined;
  confidence: "high" | "medium";
  uncertaintyNotes: string[];
}

export type SearchTripPlacesResult =
  | {
      ok: true;
      variant: string;
      day: number | undefined;
      query: SearchTripPlacesInput;
      places: RankedTripPlace[];
    }
  | {
      ok: false;
      error: string;
      validVariants: string[];
    };

export type DeepTripAnalysisType =
  | "route_improvement"
  | "multi_day_highlights"
  | "variant_comparison"
  | "weather_replan"
  | "general_planning";

export interface StartDeepTripAnalysisInput {
  question: string;
  analysis_type?: DeepTripAnalysisType;
  variant?: string;
  start_day?: number;
  end_day?: number;
  constraints?: string;
  current_date?: string;
  current_itinerary_date?: string;
  conversation_id?: string;
}

export interface DeepTripAnalysisJob {
  id: string;
  createdAt: string;
  status: "queued";
  variant: string;
  analysisType: DeepTripAnalysisType;
  question: string;
  startDay: number | undefined;
  endDay: number | undefined;
  constraints: string[];
  currentDate: string | undefined;
  currentItineraryDate: string | undefined;
  conversationId: string | undefined;
  prompt: string;
}

export type StartDeepTripAnalysisResult =
  | {
      ok: true;
      handoff: "deep_trip_analysis";
      request_id: string;
      status: "queued";
      variant: string;
      analysis_type: DeepTripAnalysisType;
      message: string;
    }
  | {
      ok: false;
      error: string;
      validVariants?: string[];
    };
