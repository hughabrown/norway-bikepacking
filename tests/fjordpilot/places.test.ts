import { describe, expect, it } from "vitest";
import { searchTripPlaces } from "../../src/fjordpilot/places";

describe("searchTripPlaces", () => {
  it("finds Beitostolen lunch/resupply options on besseggen day 4", () => {
    const result = searchTripPlaces({ day: 4, category: "eat", need: "lunch" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variant).toBe("besseggen");
      expect(result.day).toBe(4);
      expect(result.places.length).toBeGreaterThan(0);
      expect(result.places.some((place) => place.near === "Beitostolen")).toBe(true);
      expect(result.places.map((place) => place.name)).toContain("SPAR Beitostolen");
    }
  });

  it("finds sleep options near Vaset", () => {
    const result = searchTripPlaces({ near: "Vaset", category: "sleep" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.places.length).toBeGreaterThan(0);
      expect(result.places.every((place) => place.category === "sleep")).toBe(true);
    }
  });

  it("propagates lookup errors for invalid variants", () => {
    const result = searchTripPlaces({ day: 4, variant: "full", category: "eat" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Unknown variant: full");
    }
  });
});
