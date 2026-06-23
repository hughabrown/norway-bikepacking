import { describe, expect, it } from "vitest";
import { prepareTripNote } from "../../src/fjordpilot/notes";

const env = {
  writeGate: "fjord-2026",
  now: () => "2026-06-23T10:00:00.000Z",
  id: () => "note_test_1"
};

describe("prepareTripNote", () => {
  it("refuses unconfirmed writes", () => {
    const result = prepareTripNote({
      category: "decision",
      note: "Stay in Beitostolen if day 4 is too hard.",
      confirmed: false,
      write_gate: "fjord-2026"
    }, env);

    expect(result).toEqual({ ok: false, error: "Trip note was not saved because confirmation is required." });
  });

  it("refuses invalid write gates", () => {
    const result = prepareTripNote({
      category: "decision",
      note: "Stay in Beitostolen if day 4 is too hard.",
      confirmed: true,
      write_gate: "wrong"
    }, env);

    expect(result).toEqual({ ok: false, error: "Trip note was not saved because the write gate was invalid." });
  });

  it("returns a persistable note for confirmed gated writes", () => {
    const result = prepareTripNote({
      day: 4,
      variant: "besseggen",
      location: "Beitostolen",
      category: "decision",
      note: "Stay in Beitostolen if day 4 is too hard.",
      confirmed: true,
      write_gate: "fjord-2026"
    }, env);

    expect(result).toEqual({
      ok: true,
      note: {
        id: "note_test_1",
        createdAt: "2026-06-23T10:00:00.000Z",
        day: 4,
        variant: "besseggen",
        location: "Beitostolen",
        category: "decision",
        note: "Stay in Beitostolen if day 4 is too hard."
      }
    });
  });
});
