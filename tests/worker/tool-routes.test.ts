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
});
