import { prepareTripNote, type SaveTripNoteInput } from "../fjordpilot/notes";
import { searchTripPlaces } from "../fjordpilot/places";
import { lookupItineraryDay } from "../fjordpilot/trip-data";
import { isAuthorized, isPostCallWebhookAuthorized } from "./auth";
import { insertPostCallLog, insertTripNote } from "./d1-store";
import { jsonResponse, optionsResponse } from "./http";

export interface Env {
  FJORDPILOT_TOOL_TOKEN: string;
  FJORDPILOT_WRITE_GATE: string;
  DB: D1Database;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function invalidRequest(error: string): Response {
  return jsonResponse({ ok: false, error: `Invalid request: ${error}` }, { status: 400 });
}

function asObject(value: unknown): ValidationResult<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "request body must be a JSON object" };
  }

  return { ok: true, value: value as Record<string, unknown> };
}

function readOptionalString(
  input: Record<string, unknown>,
  field: string,
): ValidationResult<string | undefined> {
  const value = input[field];
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string` };
  }
  return { ok: true, value };
}

function readRequiredString(
  input: Record<string, unknown>,
  field: string,
): ValidationResult<string> {
  const value = input[field];
  if (value === undefined) {
    return { ok: false, error: `${field} is required` };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string` };
  }
  return { ok: true, value };
}

function readRequiredBoolean(
  input: Record<string, unknown>,
  field: string,
): ValidationResult<boolean> {
  const value = input[field];
  if (value === undefined) {
    return { ok: false, error: `${field} is required` };
  }
  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean` };
  }
  return { ok: true, value };
}

function readInteger(
  input: Record<string, unknown>,
  field: string,
  options: { required: boolean; minimum?: number; maximum?: number },
): ValidationResult<number | undefined> {
  const value = input[field];
  if (value === undefined) {
    return options.required
      ? { ok: false, error: `${field} is required` }
      : { ok: true, value: undefined };
  }
  if (!Number.isInteger(value)) {
    if (field === "limit") {
      return { ok: false, error: "limit must be an integer between 1 and 12" };
    }
    return { ok: false, error: `${field} must be an integer` };
  }
  const integerValue = value as number;
  if (
    (options.minimum !== undefined && integerValue < options.minimum) ||
    (options.maximum !== undefined && integerValue > options.maximum)
  ) {
    if (field === "limit") {
      return { ok: false, error: "limit must be an integer between 1 and 12" };
    }
    return { ok: false, error: `${field} must be at least ${options.minimum}` };
  }
  return { ok: true, value: integerValue };
}

function readEnum<T extends string>(
  input: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  options: { required: boolean },
): ValidationResult<T | undefined> {
  const value = input[field];
  if (value === undefined) {
    return options.required
      ? { ok: false, error: `${field} is required` }
      : { ok: true, value: undefined };
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return { ok: false, error: `${field} must be one of: ${allowed.join(", ")}` };
  }
  return { ok: true, value: value as T };
}

function validateLookupItineraryDayRequest(
  body: unknown,
): ValidationResult<{ day: number; variant?: string }> {
  const objectResult = asObject(body);
  if (!objectResult.ok) return objectResult;

  const dayResult = readInteger(objectResult.value, "day", { required: true, minimum: 0 });
  if (!dayResult.ok) return dayResult as ValidationResult<{ day: number; variant?: string }>;

  const variantResult = readOptionalString(objectResult.value, "variant");
  if (!variantResult.ok) return variantResult as ValidationResult<{ day: number; variant?: string }>;

  return {
    ok: true,
    value: {
      day: dayResult.value as number,
      ...(variantResult.value !== undefined ? { variant: variantResult.value } : {}),
    },
  };
}

function validateSearchTripPlacesRequest(body: unknown): ValidationResult<{
  day?: number;
  variant?: string;
  near?: string;
  category?: "eat" | "sleep" | "resupply" | "sight";
  need?: string;
  limit?: number;
}> {
  const objectResult = asObject(body);
  if (!objectResult.ok) return objectResult;

  const dayResult = readInteger(objectResult.value, "day", { required: false, minimum: 0 });
  if (!dayResult.ok) return dayResult as ValidationResult<{
    day?: number;
    variant?: string;
    near?: string;
    category?: "eat" | "sleep" | "resupply" | "sight";
    need?: string;
    limit?: number;
  }>;

  const variantResult = readOptionalString(objectResult.value, "variant");
  if (!variantResult.ok) return variantResult as ValidationResult<{
    day?: number;
    variant?: string;
    near?: string;
    category?: "eat" | "sleep" | "resupply" | "sight";
    need?: string;
    limit?: number;
  }>;

  const nearResult = readOptionalString(objectResult.value, "near");
  if (!nearResult.ok) return nearResult as ValidationResult<{
    day?: number;
    variant?: string;
    near?: string;
    category?: "eat" | "sleep" | "resupply" | "sight";
    need?: string;
    limit?: number;
  }>;

  const categoryResult = readEnum(
    objectResult.value,
    "category",
    ["eat", "sleep", "resupply", "sight"] as const,
    { required: false },
  );
  if (!categoryResult.ok) return categoryResult as ValidationResult<{
    day?: number;
    variant?: string;
    near?: string;
    category?: "eat" | "sleep" | "resupply" | "sight";
    need?: string;
    limit?: number;
  }>;

  const needResult = readOptionalString(objectResult.value, "need");
  if (!needResult.ok) return needResult as ValidationResult<{
    day?: number;
    variant?: string;
    near?: string;
    category?: "eat" | "sleep" | "resupply" | "sight";
    need?: string;
    limit?: number;
  }>;

  const limitResult = readInteger(objectResult.value, "limit", {
    required: false,
    minimum: 1,
    maximum: 12,
  });
  if (!limitResult.ok) return limitResult as ValidationResult<{
    day?: number;
    variant?: string;
    near?: string;
    category?: "eat" | "sleep" | "resupply" | "sight";
    need?: string;
    limit?: number;
  }>;

  return {
    ok: true,
    value: {
      ...(dayResult.value !== undefined ? { day: dayResult.value } : {}),
      ...(variantResult.value !== undefined ? { variant: variantResult.value } : {}),
      ...(nearResult.value !== undefined ? { near: nearResult.value } : {}),
      ...(categoryResult.value !== undefined ? { category: categoryResult.value } : {}),
      ...(needResult.value !== undefined ? { need: needResult.value } : {}),
      ...(limitResult.value !== undefined ? { limit: limitResult.value } : {}),
    },
  };
}

function validateSaveTripNoteRequest(body: unknown): ValidationResult<SaveTripNoteInput> {
  const objectResult = asObject(body);
  if (!objectResult.ok) return objectResult;

  const dayResult = readInteger(objectResult.value, "day", { required: false, minimum: 0 });
  if (!dayResult.ok) return dayResult as ValidationResult<SaveTripNoteInput>;

  const variantResult = readOptionalString(objectResult.value, "variant");
  if (!variantResult.ok) return variantResult as ValidationResult<SaveTripNoteInput>;

  const locationResult = readOptionalString(objectResult.value, "location");
  if (!locationResult.ok) return locationResult as ValidationResult<SaveTripNoteInput>;

  const categoryResult = readEnum(
    objectResult.value,
    "category",
    ["decision", "mechanical", "food", "weather", "lodging", "follow_up"] as const,
    { required: true },
  );
  if (!categoryResult.ok) return categoryResult as ValidationResult<SaveTripNoteInput>;

  const noteResult = readRequiredString(objectResult.value, "note");
  if (!noteResult.ok) return noteResult as ValidationResult<SaveTripNoteInput>;

  const confirmedResult = readRequiredBoolean(objectResult.value, "confirmed");
  if (!confirmedResult.ok) return confirmedResult as ValidationResult<SaveTripNoteInput>;

  const writeGateResult = readRequiredString(objectResult.value, "write_gate");
  if (!writeGateResult.ok) return writeGateResult as ValidationResult<SaveTripNoteInput>;

  return {
    ok: true,
    value: {
      ...(dayResult.value !== undefined ? { day: dayResult.value } : {}),
      ...(variantResult.value !== undefined ? { variant: variantResult.value } : {}),
      ...(locationResult.value !== undefined ? { location: locationResult.value } : {}),
      category: categoryResult.value as SaveTripNoteInput["category"],
      note: noteResult.value,
      confirmed: confirmedResult.value,
      write_gate: writeGateResult.value,
    },
  };
}

function requireToolAuth(request: Request, env: Env): Response | undefined {
  if (!isAuthorized(request, env.FJORDPILOT_TOOL_TOKEN)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return undefined;
}

function requirePostCallWebhookAuth(request: Request, env: Env): Response | undefined {
  if (!isPostCallWebhookAuthorized(request, env.FJORDPILOT_TOOL_TOKEN)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return undefined;
}

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (url.pathname === "/api/fjordpilot/health") {
    return jsonResponse({ ok: true, service: "fjordpilot" });
  }

  const isProtectedRoute =
    url.pathname.startsWith("/api/fjordpilot/tools/") ||
    url.pathname === "/api/fjordpilot/webhooks/post-call";
  if (!isProtectedRoute) {
    return jsonResponse({ ok: false, error: "Not found" }, { status: 404 });
  }

  const authError =
    url.pathname === "/api/fjordpilot/webhooks/post-call"
      ? requirePostCallWebhookAuth(request, env)
      : requireToolAuth(request, env);
  if (authError) {
    return authError;
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const body = await readJson(request);

  if (url.pathname === "/api/fjordpilot/webhooks/post-call") {
    const payload = body as Record<string, unknown>;
    await insertPostCallLog(env.DB, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      conversationId:
        typeof payload.conversation_id === "string"
          ? payload.conversation_id
          : undefined,
      payload,
    });
    return jsonResponse({ ok: true });
  }

  if (url.pathname === "/api/fjordpilot/tools/lookup_itinerary_day") {
    const parsed = validateLookupItineraryDayRequest(body);
    if (!parsed.ok) {
      return invalidRequest(parsed.error);
    }
    return jsonResponse(lookupItineraryDay(parsed.value));
  }

  if (url.pathname === "/api/fjordpilot/tools/search_trip_places") {
    const parsed = validateSearchTripPlacesRequest(body);
    if (!parsed.ok) {
      return invalidRequest(parsed.error);
    }
    return jsonResponse(searchTripPlaces(parsed.value));
  }

  if (url.pathname === "/api/fjordpilot/tools/save_trip_note") {
    const parsed = validateSaveTripNoteRequest(body);
    if (!parsed.ok) {
      return invalidRequest(parsed.error);
    }

    const prepared = prepareTripNote(parsed.value, {
      writeGate: env.FJORDPILOT_WRITE_GATE,
      now: () => new Date().toISOString(),
      id: () => crypto.randomUUID(),
    });
    if (!prepared.ok) {
      return jsonResponse(prepared, { status: 400 });
    }

    await insertTripNote(env.DB, prepared.note);
    return jsonResponse(prepared);
  }

  return jsonResponse({ ok: false, error: "Unknown tool" }, { status: 404 });
}

export default {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
};
