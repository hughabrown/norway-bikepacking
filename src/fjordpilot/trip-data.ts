import rawTrip from "./generated/tripdata.json";
import {
  DEFAULT_VARIANT,
  type LookupItineraryDayInput,
  type LookupItineraryDayResult,
  type ResolveDateInput,
  type ResolveDateResult,
  type Trip,
} from "./types";

const trip = rawTrip as Trip;

export function getTrip(): Trip {
  return trip;
}

export function getValidVariants(): string[] {
  return Object.keys(trip.variants);
}

export function getVariantKey(input?: string): string {
  const requested = input?.trim();
  if (requested && trip.variants[requested]) {
    return requested;
  }
  return DEFAULT_VARIANT;
}

export function lookupItineraryDay(input: LookupItineraryDayInput): LookupItineraryDayResult {
  const validVariants = getValidVariants();
  const requestedVariant = input.variant?.trim();
  if (requestedVariant && !trip.variants[requestedVariant]) {
    return { ok: false, error: `Unknown variant: ${requestedVariant}`, validVariants };
  }

  const variant = getVariantKey(requestedVariant);
  const variantData = trip.variants[variant];
  const stage = variantData?.stages.find((candidate) => candidate.day === input.day);

  if (!variantData || !stage) {
    return {
      ok: false,
      error: `No itinerary day ${input.day} for variant ${variant}`,
      validVariants,
    };
  }

  return {
    ok: true,
    variant,
    variantLabel: variantData.label,
    day: stage.day,
    stage,
  };
}

export function resolveItineraryDayFromDate(input: ResolveDateInput): ResolveDateResult {
  const variant = getVariantKey(input.variant);
  const stages = trip.variants[variant]?.stages ?? [];
  const match = stages.find((stage) => stage.date === input.currentDate);
  const datedStages = stages.filter((stage) => stage.date);
  const start = datedStages[0]?.date ?? "";
  const end = datedStages[datedStages.length - 1]?.date ?? "";

  if (!match) {
    return {
      ok: false,
      error: `${input.currentDate} does not match an itinerary date for ${variant}`,
      validDateRange: { start, end },
    };
  }

  return {
    ok: true,
    variant,
    day: match.day,
    date: match.date,
  };
}
