import { describe, it, expect } from "vitest";
import { masToKmh } from "./tests.js";

describe("masToKmh — MAS m/s → km/h (×3,6)", () => {
  it("convertit et arrondit à 0,1", () => {
    expect(masToKmh(4)).toBe(14.4);      // 1200 m / 300 s → 4 m/s → 14.4 km/h
    expect(masToKmh(5)).toBe(18);
    expect(masToKmh(4.72)).toBe(17);     // 4.72 × 3.6 = 16.992 → 17.0
  });
  it("renvoie null pour une valeur non exploitable", () => {
    expect(masToKmh(null)).toBe(null);
    expect(masToKmh("")).toBe(null);
    expect(masToKmh(0)).toBe(null);
    expect(masToKmh(-3)).toBe(null);
    expect(masToKmh("abc")).toBe(null);
  });
  it("accepte une chaîne numérique (saisie)", () => {
    expect(masToKmh("4.5")).toBe(16.2);
  });
});
