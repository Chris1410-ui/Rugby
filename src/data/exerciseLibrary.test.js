import { describe, it, expect } from "vitest";
import { buildTypeFilterOr } from "./exerciseLibrary.js";
import { libraryFilterForType } from "../lib/sessionType.js";

describe("buildTypeFilterOr — clause OR PostgREST par type", () => {
  it("null si pas de filtre", () => {
    expect(buildTypeFilterOr(null)).toBeNull();
    expect(buildTypeFilterOr({})).toBeNull();
  });

  it("conditioning → body_part.eq.cardio", () => {
    expect(buildTypeFilterOr(libraryFilterForType("conditioning"))).toBe("body_part.eq.cardio");
  });

  it("bodyweight → equipment OU no_equipment", () => {
    expect(buildTypeFilterOr(libraryFilterForType("bodyweight")))
      .toBe("equipment.eq.body weight,no_equipment.is.true");
  });

  it("skills → exercise_type.in + is_calisthenics", () => {
    const c = buildTypeFilterOr(libraryFilterForType("skills"));
    expect(c).toContain("is_calisthenics.is.true");
    expect(c).toContain("exercise_type.in.(skill_statique,skill_dynamique,freestyle)");
  });

  it("strength/mixed → null (aucun filtre)", () => {
    expect(buildTypeFilterOr(libraryFilterForType("strength"))).toBeNull();
    expect(buildTypeFilterOr(libraryFilterForType("mixed"))).toBeNull();
  });
});
