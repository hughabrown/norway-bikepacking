import { describe, expect, it } from "vitest";
import { handleRequest, type Env } from "../../src/worker";

class FakeStatement {
  constructor(
    private readonly sink: unknown[][],
    private readonly sql: string,
  ) {}

  private values: unknown[] = [];

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async run() {
    this.sink.push([this.sql, ...this.values]);
    return { success: true };
  }
}

class FakeD1 {
  writes: unknown[][] = [];

  prepare(sql: string) {
    return new FakeStatement(this.writes, sql);
  }
}

function env(): Env & { DB: FakeD1 } {
  return {
    FJORDPILOT_TOOL_TOKEN: "tool-token",
    FJORDPILOT_WRITE_GATE: "fjord-2026",
    DB: new FakeD1() as unknown as D1Database,
  } as Env & { DB: FakeD1 };
}

function post(path: string, body: unknown, token = "tool-token") {
  return new Request(`https://fjordpilot.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function postWithHeaders(path: string, body: unknown, headers: Record<string, string>) {
  return new Request(`https://fjordpilot.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function expectInvalidRequest(response: Response, error: string) {
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    error: `Invalid request: ${error}`,
  });
}

describe("FjordPilot worker routes", () => {
  it("returns health without auth", async () => {
    const response = await handleRequest(
      new Request("https://fjordpilot.test/api/fjordpilot/health"),
      env(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "fjordpilot",
    });
  });

  it("rejects tool requests without the bearer token", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/lookup_itinerary_day", { day: 4 }, "bad-token"),
      env(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("serves lookup_itinerary_day", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/lookup_itinerary_day", { day: 4 }),
      env(),
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      stage: { from: string; to: string };
    };
    expect(json.ok).toBe(true);
    expect(json.stage.from).toBe("Gjendesheim");
    expect(json.stage.to).toBe("Vaset");
  });

  it("rejects lookup_itinerary_day when day is missing", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/lookup_itinerary_day", {}),
      env(),
    );

    await expectInvalidRequest(response, "day is required");
  });

  it("rejects lookup_itinerary_day when day is not an integer", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/lookup_itinerary_day", { day: "4" }),
      env(),
    );

    await expectInvalidRequest(response, "day must be an integer");
  });

  it("serves search_trip_places", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/search_trip_places", {
        day: 4,
        category: "eat",
        need: "lunch",
      }),
      env(),
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      places: Array<{ name: string }>;
    };
    expect(json.ok).toBe(true);
    expect(json.places.map((place) => place.name)).toContain("SPAR Beitostolen");
  });

  it("rejects search_trip_places when near is not a string", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/search_trip_places", { near: 4 }),
      env(),
    );

    await expectInvalidRequest(response, "near must be a string");
  });

  it("rejects search_trip_places when limit is not an integer", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/search_trip_places", { limit: "4" }),
      env(),
    );

    await expectInvalidRequest(response, "limit must be an integer between 1 and 12");
  });

  it("rejects search_trip_places when limit is out of range", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/search_trip_places", { limit: 13 }),
      env(),
    );

    await expectInvalidRequest(response, "limit must be an integer between 1 and 12");
  });

  it("persists save_trip_note through D1", async () => {
    const testEnv = env();
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        day: 4,
        variant: "besseggen",
        location: "Beitostolen",
        category: "decision",
        note: "Stay in Beitostolen if day 4 is too hard.",
        confirmed: true,
        write_gate: "fjord-2026",
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      note: { location: string };
    };
    expect(json.ok).toBe(true);
    expect(json.note.location).toBe("Beitostolen");
    expect(testEnv.DB.writes.length).toBe(1);
  });

  it("rejects save_trip_note when note is missing", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        category: "decision",
        confirmed: true,
        write_gate: "fjord-2026",
      }),
      env(),
    );

    await expectInvalidRequest(response, "note is required");
  });

  it("rejects save_trip_note when note is not a string", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        category: "decision",
        note: false,
        confirmed: true,
        write_gate: "fjord-2026",
      }),
      env(),
    );

    await expectInvalidRequest(response, "note must be a string");
  });

  it("rejects save_trip_note when category is not supported", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        category: 7,
        note: "Stay in Beitostolen if day 4 is too hard.",
        confirmed: true,
        write_gate: "fjord-2026",
      }),
      env(),
    );

    await expectInvalidRequest(
      response,
      "category must be one of: decision, mechanical, food, weather, lodging, follow_up",
    );
  });

  it("rejects save_trip_note when category is missing", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        note: "Stay in Beitostolen if day 4 is too hard.",
        confirmed: true,
        write_gate: "fjord-2026",
      }),
      env(),
    );

    await expectInvalidRequest(response, "category is required");
  });

  it("rejects save_trip_note when confirmed is not a boolean", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        category: "decision",
        note: "Stay in Beitostolen if day 4 is too hard.",
        confirmed: "yes",
        write_gate: "fjord-2026",
      }),
      env(),
    );

    await expectInvalidRequest(response, "confirmed must be a boolean");
  });

  it("rejects save_trip_note when confirmed is missing", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/save_trip_note", {
        category: "decision",
        note: "Stay in Beitostolen if day 4 is too hard.",
        write_gate: "fjord-2026",
      }),
      env(),
    );

    await expectInvalidRequest(response, "confirmed is required");
  });

  it("queues start_deep_trip_analysis through D1", async () => {
    const testEnv = env();
    const response = await handleRequest(
      post("/api/fjordpilot/tools/start_deep_trip_analysis", {
        question: "Can you give me the highlights of the next five days?",
        analysis_type: "multi_day_highlights",
        variant: "besseggen",
        start_day: 3,
        end_day: 7,
        constraints: "Keep ride days realistic if the weather turns.",
        current_date: "2026-07-12",
        current_itinerary_date: "2026-07-12",
        conversation_id: "conv_deep_1",
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      handoff: string;
      request_id: string;
      status: string;
      variant: string;
      analysis_type: string;
    };
    expect(json.ok).toBe(true);
    expect(json.handoff).toBe("deep_trip_analysis");
    expect(json.request_id).toBeTruthy();
    expect(json.status).toBe("queued");
    expect(json.variant).toBe("besseggen");
    expect(json.analysis_type).toBe("multi_day_highlights");
    expect(testEnv.DB.writes.length).toBe(1);
    expect(String(testEnv.DB.writes[0]?.[0])).toContain("deep_trip_analysis_jobs");
    expect(testEnv.DB.writes[0]).toContain("conv_deep_1");
  });

  it("rejects start_deep_trip_analysis when question is missing", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/start_deep_trip_analysis", {
        analysis_type: "multi_day_highlights",
      }),
      env(),
    );

    await expectInvalidRequest(response, "question is required");
  });

  it("rejects start_deep_trip_analysis when analysis_type is not supported", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/start_deep_trip_analysis", {
        question: "Is there a better way of doing this trip?",
        analysis_type: "huge_model_magic",
      }),
      env(),
    );

    await expectInvalidRequest(
      response,
      "analysis_type must be one of: route_improvement, multi_day_highlights, variant_comparison, weather_replan, general_planning",
    );
  });

  it("rejects start_deep_trip_analysis when constraints is not a string", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/start_deep_trip_analysis", {
        question: "Is there a better way of doing this trip?",
        constraints: ["shorter days"],
      }),
      env(),
    );

    await expectInvalidRequest(response, "constraints must be a string");
  });

  it("stores post-call webhook payloads", async () => {
    const testEnv = env();
    const response = await handleRequest(
      post("/api/fjordpilot/webhooks/post-call", {
        conversation_id: "conv_1",
        summary: "Discussed day 4 bailout and Beitostolen resupply.",
        follow_up_needed: false,
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(testEnv.DB.writes.length).toBe(1);
  });

  it("accepts the ElevenLabs-compatible token header for post-call webhooks", async () => {
    const testEnv = env();
    const response = await handleRequest(
      postWithHeaders(
        "/api/fjordpilot/webhooks/post-call",
        {
          conversation_id: "conv_2",
          summary: "Logged through the workspace webhook.",
        },
        { "x-fjordpilot-tool-token": "tool-token" },
      ),
      testEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(testEnv.DB.writes.length).toBe(1);
  });
});
