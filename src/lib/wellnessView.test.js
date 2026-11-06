import { describe, it, expect } from "vitest";
import { favMarkers, reverse10, recoveryIndex, statusOf, needsWatch, remarkOf, rpeOf } from "./wellnessView.js";

describe("wellnessView (affichage staff, favorable)", () => {
  it("inverse fatigue/stress (haut = pire → haut = mieux)", () => {
    const f = favMarkers({ sleep: 8, fatigue: 2, stress: 3, mood: 9, genWell: 7, willTrain: 6 });
    expect(f.sommeil).toBe(8);
    expect(f.fatigue).toBe(9); // 11 - 2
    expect(f.stress).toBe(8);  // 11 - 3
    expect(f.humeur).toBe(9);
    expect(f.wellness).toBe(7);
    expect(f.willTrain).toBe(6);
  });

  it("reverse10 est null-safe", () => {
    expect(reverse10(undefined)).toBeNull();
    expect(reverse10(1)).toBe(10);
    expect(reverse10(10)).toBe(1);
  });

  it("indice de récupération = moyenne favorable des 4 marqueurs", () => {
    // sommeil 8, fatigue 11-2=9, stress 11-3=8, humeur 9 → (8+9+8+9)/4 = 8.5
    expect(recoveryIndex({ sleep: 8, fatigue: 2, stress: 3, mood: 9 })).toBe(8.5);
    expect(recoveryIndex({})).toBeNull();
  });

  it("statut OK/Vigilance/Alerte", () => {
    expect(statusOf(8)).toBe("ok");
    expect(statusOf(6)).toBe("vigilance");
    expect(statusOf(4)).toBe("alerte");
    expect(statusOf(null)).toBeNull();
  });

  it("à surveiller si récupération faible ou remarque", () => {
    expect(needsWatch({ sleep: 9, fatigue: 1, stress: 1, mood: 9 })).toBe(false); // bon
    expect(needsWatch({ sleep: 3, fatigue: 8, stress: 8, mood: 3 })).toBe(true); // faible
    expect(needsWatch({ sleep: 9, fatigue: 1, stress: 1, mood: 9, remark: "mal au cou" })).toBe(true);
  });

  it("remarque et rpe lus proprement", () => {
    expect(remarkOf({ remark: "  " })).toBeNull();
    expect(remarkOf({ remark: "genou" })).toBe("genou");
    expect(rpeOf({ rpePrev: 4 })).toBe(4);
    expect(rpeOf({})).toBeNull();
  });
});
