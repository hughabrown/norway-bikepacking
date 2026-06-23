import { getTrip, getValidVariants, getVariantKey } from "./trip-data";
import type {
  DeepTripAnalysisJob,
  DeepTripAnalysisType,
  StartDeepTripAnalysisInput,
  StartDeepTripAnalysisResult,
} from "./types";

export const DEEP_TRIP_ANALYSIS_TYPES = [
  "route_improvement",
  "multi_day_highlights",
  "variant_comparison",
  "weather_replan",
  "general_planning",
] as const satisfies readonly DeepTripAnalysisType[];

export interface DeepTripAnalysisEnv {
  now: () => string;
  id: () => string;
}

export type PreparedDeepTripAnalysis =
  | {
      ok: true;
      job: DeepTripAnalysisJob;
      result: Extract<StartDeepTripAnalysisResult, { ok: true }>;
    }
  | Extract<StartDeepTripAnalysisResult, { ok: false }>;

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeConstraints(constraints: string | undefined): string[] {
  const trimmed = constraints?.trim();
  return trimmed ? [trimmed] : [];
}

function stageLine(stage: {
  day: number;
  date: string;
  from: string;
  to: string;
  km: number;
  ascentM: number;
  overnight: string;
  summary: string;
  notes: string;
}): string {
  const notes = stage.notes ? ` Notes: ${stage.notes}` : "";
  return `Day ${stage.day} (${stage.date}): ${stage.from} -> ${stage.to}, ${stage.km} km, ${stage.ascentM} m ascent, overnight ${stage.overnight}. ${stage.summary}${notes}`;
}

function buildVariantContext(
  variant: string,
  analysisType: DeepTripAnalysisType,
  startDay: number | undefined,
  endDay: number | undefined,
): string {
  const trip = getTrip();
  const variantKeys =
    analysisType === "variant_comparison" ? Object.keys(trip.variants) : [variant];

  return variantKeys
    .map((variantKey) => {
      const variantData = trip.variants[variantKey];
      if (!variantData) {
        return "";
      }

      const stages = variantData.stages.filter((stage) => {
        if (startDay !== undefined && stage.day < startDay) return false;
        if (endDay !== undefined && stage.day > endDay) return false;
        return true;
      });

      return [
        `Variant ${variantKey}: ${variantData.label} (${variantData.sub})`,
        ...stages.map(stageLine),
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildPrompt(input: {
  question: string;
  analysisType: DeepTripAnalysisType;
  variant: string;
  startDay: number | undefined;
  endDay: number | undefined;
  constraints: string[];
  currentDate: string | undefined;
  currentItineraryDate: string | undefined;
}): string {
  const window =
    input.startDay === undefined && input.endDay === undefined
      ? "whole itinerary"
      : `days ${input.startDay ?? "start"} through ${input.endDay ?? "end"}`;
  const constraints =
    input.constraints.length > 0 ? input.constraints.join("; ") : "None supplied.";

  return [
    "You are the FjordPilot deep itinerary analysis runner.",
    "Use a stronger reasoning model and the full route context before answering.",
    "Give Hugh a concise answer first, then the reasoning and any checks he should do live.",
    "Do not invent live weather, opening hours, booking availability, ferries, trains, roads, or trail status.",
    "If a change to the source itinerary is needed, return a PRD-style change summary rather than editing files directly.",
    "",
    `Question: ${input.question}`,
    `Analysis type: ${input.analysisType}`,
    `Selected variant: ${input.variant}`,
    `Requested window: ${window}`,
    `Current date: ${input.currentDate ?? "unknown"}`,
    `Current itinerary date: ${input.currentItineraryDate ?? "unknown"}`,
    `Constraints: ${constraints}`,
    "",
    "Route context:",
    buildVariantContext(input.variant, input.analysisType, input.startDay, input.endDay),
  ].join("\n");
}

export function prepareDeepTripAnalysis(
  input: StartDeepTripAnalysisInput,
  env: DeepTripAnalysisEnv,
): PreparedDeepTripAnalysis {
  const question = input.question.trim();
  if (question.length < 5) {
    return { ok: false, error: "Deep analysis question is too short." };
  }

  const validVariants = getValidVariants();
  const requestedVariant = normalizeOptionalText(input.variant);
  if (requestedVariant && !validVariants.includes(requestedVariant)) {
    return {
      ok: false,
      error: `Unknown variant: ${requestedVariant}`,
      validVariants,
    };
  }

  if (
    input.start_day !== undefined &&
    input.end_day !== undefined &&
    input.end_day < input.start_day
  ) {
    return { ok: false, error: "end_day must be greater than or equal to start_day." };
  }

  const analysisType = input.analysis_type ?? "general_planning";
  const variant = getVariantKey(requestedVariant);
  const constraints = normalizeConstraints(input.constraints);
  const currentDate = normalizeOptionalText(input.current_date);
  const currentItineraryDate = normalizeOptionalText(input.current_itinerary_date);
  const conversationId = normalizeOptionalText(input.conversation_id);
  const createdAt = env.now();
  const id = env.id();
  const prompt = buildPrompt({
    question,
    analysisType,
    variant,
    startDay: input.start_day,
    endDay: input.end_day,
    constraints,
    currentDate,
    currentItineraryDate,
  });

  const job: DeepTripAnalysisJob = {
    id,
    createdAt,
    status: "queued",
    variant,
    analysisType,
    question,
    startDay: input.start_day,
    endDay: input.end_day,
    constraints,
    currentDate,
    currentItineraryDate,
    conversationId,
    prompt,
  };

  return {
    ok: true,
    job,
    result: {
      ok: true,
      handoff: "deep_trip_analysis",
      request_id: id,
      status: "queued",
      variant,
      analysis_type: analysisType,
      message:
        "Deep itinerary analysis is queued. Use the request id to track the async result; the final answer is not ready yet.",
    },
  };
}
