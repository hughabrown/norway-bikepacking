import { describe, expect, it } from "vitest";
import { lookupItineraryDay, resolveItineraryDayFromDate } from "../../src/fjordpilot/trip-data";
import { TRIP_TIMEZONE } from "../../src/fjordpilot/types";

describe("lookupItineraryDay", () => {
  it("defaults to the besseggen variant", () => {
    const result = lookupItineraryDay({ day: 4 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variant).toBe("besseggen");
      expect(result.stage.from).toBe("Gjendesheim");
      expect(result.stage.to).toBe("Vaset");
    }
  });

  it("uses the requested variant when supplied", () => {
    const result = lookupItineraryDay({ day: 4, variant: "gravel" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variant).toBe("gravel");
      expect(result.stage.from).toBe("Vaset");
      expect(result.stage.to).toBe("Gol");
    }
  });

  it("returns valid variants for an unknown variant", () => {
    const result = lookupItineraryDay({ day: 4, variant: "full" });

    expect(result).toEqual({
      ok: false,
      error: "Unknown variant: full",
      validVariants: ["besseggen", "gravel"],
    });
  });
});

describe("resolveItineraryDayFromDate", () => {
  it("maps an itinerary date to the matching day", () => {
    const result = resolveItineraryDayFromDate({ currentDate: "2026-07-13" });

    expect(result).toEqual({
      ok: true,
      variant: "besseggen",
      day: 4,
      date: "2026-07-13",
    });
  });

  it("asks for clarification when the date is outside the itinerary", () => {
    const result = resolveItineraryDayFromDate({ currentDate: "2026-06-23" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not match");
      expect(result.validDateRange).toEqual({ start: "2026-07-09", end: "2026-07-19" });
    }
  });
});

describe("trip timezone constant", () => {
  it("uses Europe/Oslo for relative trip dates", () => {
    expect(TRIP_TIMEZONE).toBe("Europe/Oslo");
  });
});
