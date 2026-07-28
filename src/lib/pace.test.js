import { describe, it, expect } from "vitest";
import {
  MS_TO_KMH, msToKmh, kmhToMs,
  computeTargetSpeedKmh, paceSecPerKmFromKmh, computeTargetPace, paceTargetForBlock,
  speedKmhFromDistanceTime, paceSecPerKmFromDistanceTime,
  formatPace, formatSpeed,
} from "./pace.js";

describe("pace — conversions d'unité (piège km/h vs m/s)", () => {
  it("m/s → km/h ×3,6 et retour", () => {
    expect(MS_TO_KMH).toBe(3.6);
    expect(msToKmh(5)).toBe(18);      // MAS 5 m/s = 18 km/h
    expect(kmhToMs(18)).toBe(5);
    expect(msToKmh(0)).toBeNull();
    expect(kmhToMs(-1)).toBeNull();
  });
});

describe("pace — allure cible depuis %VMA + MAS (km/h)", () => {
  it("calcule vitesse et allure cibles", () => {
    expect(computeTargetSpeedKmh(70, 18)).toBeCloseTo(12.6, 5); // 70% de 18 km/h
    const r = computeTargetPace(70, 18);
    expect(r.needsMas).toBe(false);
    expect(r.speedKmh).toBeCloseTo(12.6, 5);
    expect(r.secPerKm).toBeCloseTo(3600 / 12.6, 3); // ≈ 285,7 s/km
    expect(formatPace(r.secPerKm)).toBe("4:46");
  });

  it("MAS absente + %VMA présent → needsMas (jamais une allure fausse)", () => {
    const r = computeTargetPace(80, 0);
    expect(r).toEqual({ speedKmh: null, secPerKm: null, needsMas: true });
    expect(computeTargetSpeedKmh(80, null)).toBeNull();
    expect(computeTargetPace(80, undefined).needsMas).toBe(true);
  });

  it("%VMA absent → pas de cible demandée (needsMas false, null)", () => {
    expect(computeTargetPace(0, 18)).toEqual({ speedKmh: null, secPerKm: null, needsMas: false });
    expect(computeTargetPace(null, 18).needsMas).toBe(false);
  });

  it("le piège d'unité change le résultat : brut 5 (m/s) ≠ converti 18 (km/h)", () => {
    const wrong = computeTargetPace(100, 5);        // 5 passé comme km/h par erreur
    const right = computeTargetPace(100, msToKmh(5)); // 5 m/s → 18 km/h
    expect(right.speedKmh).toBe(18);
    expect(wrong.speedKmh).toBe(5);
    expect(right.secPerKm).not.toBeCloseTo(wrong.secPerKm, 1);
  });

  it("paceTargetForBlock lit block.pctVMA", () => {
    expect(paceTargetForBlock({ pctVMA: 70 }, 18).speedKmh).toBeCloseTo(12.6, 5);
    expect(paceTargetForBlock({}, 18).needsMas).toBe(false);
    expect(paceTargetForBlock({ pctVMA: 90 }, null).needsMas).toBe(true);
  });
});

describe("pace — allure/vitesse réalisées depuis distance + temps", () => {
  it("6 × 200 m en 30 s → 24 km/h, 2:30/km", () => {
    expect(speedKmhFromDistanceTime(200, 30)).toBeCloseTo(24, 5);
    expect(paceSecPerKmFromDistanceTime(200, 30)).toBe(150);
    expect(formatPace(150)).toBe("2:30");
  });

  it("footing 5 km en 25 min → 12 km/h, 5:00/km", () => {
    expect(speedKmhFromDistanceTime(5000, 1500)).toBeCloseTo(12, 5);
    expect(paceSecPerKmFromDistanceTime(5000, 1500)).toBe(300);
    expect(formatPace(300)).toBe("5:00");
  });

  it("entrées invalides → null (jamais 0 ni NaN)", () => {
    expect(speedKmhFromDistanceTime(0, 30)).toBeNull();
    expect(speedKmhFromDistanceTime(200, 0)).toBeNull();
    expect(paceSecPerKmFromDistanceTime(-1, 30)).toBeNull();
    expect(paceSecPerKmFromKmh(0)).toBeNull();
  });
});

describe("pace — formatage", () => {
  it("formatPace 'm:ss' (secondes arrondies), '' si null", () => {
    expect(formatPace(285.7)).toBe("4:46");
    expect(formatPace(65)).toBe("1:05");
    expect(formatPace(null)).toBe("");
    expect(formatPace(0)).toBe("");
  });

  it("formatSpeed 'X.X km/h', '' si null", () => {
    expect(formatSpeed(12.6)).toBe("12.6 km/h");
    expect(formatSpeed(null)).toBe("");
  });
});
