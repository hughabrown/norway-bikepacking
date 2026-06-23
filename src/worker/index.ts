import { prepareTripNote, type SaveTripNoteInput } from "../fjordpilot/notes";
import { searchTripPlaces } from "../fjordpilot/places";
import { lookupItineraryDay } from "../fjordpilot/trip-data";
import { isAuthorized } from "./auth";
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

function requireToolAuth(request: Request, env: Env): Response | undefined {
  if (!isAuthorized(request, env.FJORDPILOT_TOOL_TOKEN)) {
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

  const authError = requireToolAuth(request, env);
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
    return jsonResponse(lookupItineraryDay(body as { day: number; variant?: string }));
  }

  if (url.pathname === "/api/fjordpilot/tools/search_trip_places") {
    return jsonResponse(
      searchTripPlaces(body as {
        day?: number;
        variant?: string;
        near?: string;
        category?: "eat" | "sleep" | "resupply" | "sight";
        need?: string;
        limit?: number;
      }),
    );
  }

  if (url.pathname === "/api/fjordpilot/tools/save_trip_note") {
    const prepared = prepareTripNote(body as SaveTripNoteInput, {
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
