import { describe, expect, it } from "vitest";
import { handleRequest, type Env } from "../../src/worker";

class FakeStatement {
  constructor(
    private readonly db: FakeD1,
    private readonly sql: string,
  ) {}

  private values: unknown[] = [];

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async run() {
    this.db.writes.push([this.sql, ...this.values]);
    if (this.sql.includes("UPDATE deep_trip_analysis_jobs")) {
      const normalizedSql = this.sql.replace(/\s+/g, " ").trim();
      if (normalizedSql.includes("SET status = 'running'")) {
        const [updatedAt, id] = this.values as [string, string];
        this.db.deepRows = this.db.deepRows.map((row) =>
          row.id === id && row.status === "queued"
            ? { ...row, status: "running", updated_at: updatedAt }
            : row,
        );
      }
      if (normalizedSql.includes("SET status = 'completed'")) {
        const [resultJson, updatedAt, id] = this.values as [string, string, string];
        this.db.deepRows = this.db.deepRows.map((row) =>
          row.id === id
            ? {
                ...row,
                status: "completed",
                result_json: resultJson,
                updated_at: updatedAt,
              }
            : row,
        );
      }
      if (normalizedSql.includes("SET status = 'failed'")) {
        const [resultJson, updatedAt, id] = this.values as [string, string, string];
        this.db.deepRows = this.db.deepRows.map((row) =>
          row.id === id
            ? {
                ...row,
                status: "failed",
                result_json: resultJson,
                updated_at: updatedAt,
              }
            : row,
        );
      }
    }
    return { success: true };
  }

  async first<T>() {
    if (!this.sql.includes("FROM deep_trip_analysis_jobs")) {
      return null;
    }

    if (this.sql.includes("WHERE id = ?")) {
      return (this.db.deepRows.find((row) => row.id === this.values[0]) ?? null) as T | null;
    }

    if (this.sql.includes("WHERE status = 'queued'")) {
      return (
        this.db.deepRows
          .filter((row) => row.status === "queued")
          .sort((left, right) => left.created_at.localeCompare(right.created_at))[0] ?? null
      ) as T | null;
    }

    return null;
  }
}

type FakeDeepRow = {
  id: string;
  created_at: string;
  status: string;
  variant: string;
  analysis_type: string;
  question: string;
  start_day: number | null;
  end_day: number | null;
  constraints_json: string;
  current_date: string | null;
  current_itinerary_date: string | null;
  conversation_id: string | null;
  prompt: string;
  result_json: string | null;
  updated_at: string | null;
};

class FakeD1 {
  writes: unknown[][] = [];
  deepRows: FakeDeepRow[] = [];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }
}

function env(): Env & { DB: FakeD1 } {
  return {
    FJORDPILOT_TOOL_TOKEN: "tool-token",
    FJORDPILOT_ADMIN_TOKEN: "admin-token",
    FJORDPILOT_WRITE_GATE: "fjord-2026",
    DB: new FakeD1() as unknown as D1Database,
  } as Env & { DB: FakeD1 };
}

function deepRow(overrides: Partial<FakeDeepRow> = {}): FakeDeepRow {
  return {
    id: "deep_1",
    created_at: "2026-06-23T10:00:00.000Z",
    status: "queued",
    variant: "besseggen",
    analysis_type: "multi_day_highlights",
    question: "Can you give me the highlights of the next five days?",
    start_day: 3,
    end_day: 7,
    constraints_json: JSON.stringify(["Keep ride days realistic."]),
    current_date: "2026-07-12",
    current_itinerary_date: "2026-07-12",
    conversation_id: "conv_1",
    prompt: "Deep analysis prompt",
    result_json: null,
    updated_at: null,
    ...overrides,
  };
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

function adminPost(path: string, body: unknown, token = "admin-token") {
  return post(path, body, token);
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

  it("rejects admin requests without the admin bearer token", async () => {
    const response = await handleRequest(
      adminPost("/api/fjordpilot/admin/deep-analysis/claim-next", {}, "tool-token"),
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

  it("claims the next queued deep-analysis job", async () => {
    const testEnv = env();
    testEnv.DB.deepRows.push(
      deepRow({ id: "deep_later", created_at: "2026-06-23T11:00:00.000Z" }),
      deepRow({ id: "deep_earlier", created_at: "2026-06-23T09:00:00.000Z" }),
    );

    const response = await handleRequest(
      adminPost("/api/fjordpilot/admin/deep-analysis/claim-next", {}),
      testEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      status: string;
      job: { id: string; status: string; prompt: string };
    };
    expect(json.ok).toBe(true);
    expect(json.status).toBe("claimed");
    expect(json.job.id).toBe("deep_earlier");
    expect(json.job.status).toBe("running");
    expect(json.job.prompt).toBe("Deep analysis prompt");
    expect(testEnv.DB.deepRows.find((row) => row.id === "deep_earlier")?.status).toBe("running");
  });

  it("returns empty when no deep-analysis jobs are queued", async () => {
    const response = await handleRequest(
      adminPost("/api/fjordpilot/admin/deep-analysis/claim-next", {}),
      env(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "empty" });
  });

  it("completes a deep-analysis job", async () => {
    const testEnv = env();
    testEnv.DB.deepRows.push(deepRow({ status: "running" }));

    const response = await handleRequest(
      adminPost("/api/fjordpilot/admin/deep-analysis/complete", {
        request_id: "deep_1",
        answer: "Here is the completed deeper analysis with enough useful detail.",
        model: "codex-test",
        runner: "hermes-test",
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      status: string;
      result: { answer: string; model: string; runner: string };
    };
    expect(json.ok).toBe(true);
    expect(json.status).toBe("completed");
    expect(json.result.answer).toContain("completed deeper analysis");
    expect(json.result.model).toBe("codex-test");
    expect(json.result.runner).toBe("hermes-test");
  });

  it("fails a deep-analysis job", async () => {
    const testEnv = env();
    testEnv.DB.deepRows.push(deepRow({ status: "running" }));

    const response = await handleRequest(
      adminPost("/api/fjordpilot/admin/deep-analysis/fail", {
        request_id: "deep_1",
        error: "Codex timed out.",
        runner: "hermes-test",
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      status: string;
      error: string;
    };
    expect(json.ok).toBe(true);
    expect(json.status).toBe("failed");
    expect(json.error).toBe("Codex timed out.");
  });

  it("serves completed deep-analysis status to the voice agent", async () => {
    const testEnv = env();
    testEnv.DB.deepRows.push(
      deepRow({
        status: "completed",
        result_json: JSON.stringify({
          answer: "The next five days are hike, long ride, recovery, resupply, and finish.",
          model: "codex-test",
          runner: "hermes-test",
          completedAt: "2026-06-23T12:00:00.000Z",
        }),
        updated_at: "2026-06-23T12:00:00.000Z",
      }),
    );

    const response = await handleRequest(
      post("/api/fjordpilot/tools/get_deep_trip_analysis", {
        request_id: "deep_1",
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      status: string;
      result: { answer: string };
    };
    expect(json.ok).toBe(true);
    expect(json.status).toBe("completed");
    expect(json.result.answer).toContain("The next five days");
  });

  it("returns 404 for an unknown deep-analysis request id", async () => {
    const response = await handleRequest(
      post("/api/fjordpilot/tools/get_deep_trip_analysis", {
        request_id: "missing",
      }),
      env(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "No deep analysis request found for missing.",
    });
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
