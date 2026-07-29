import { describe, it, expect } from "vitest";
import { parsePrescribedMetrics } from "./effort.js";

describe("parsePrescribedMetrics — unités explicites uniquement", () => {
  it("watts", () => {
    expect(parsePrescribedMetrics("250 watts").watts).toBe(250);
    expect(parsePrescribedMetrics("250W").watts).toBe(250);
    expect(parsePrescribedMetrics("180 w").watts).toBe(180);
  });
  it("kcal", () => {
    expect(parsePrescribedMetrics("100 kcal").kcal).toBe(100);
    expect(parsePrescribedMetrics("80 cal").kcal).toBe(80);
  });
  it("durée en minutes / mm:ss / secondes", () => {
    expect(parsePrescribedMetrics("6 min").durationSec).toBe(360);
    expect(parsePrescribedMetrics("6min").durationSec).toBe(360);
    expect(parsePrescribedMetrics("6:30").durationSec).toBe(390);
    expect(parsePrescribedMetrics("90 s").durationSec).toBe(90);
  });
  it("distance en m et km", () => {
    expect(parsePrescribedMetrics("400 m").distanceM).toBe(400);
    expect(parsePrescribedMetrics("1,5 km").distanceM).toBe(1500);
    expect(parsePrescribedMetrics("5km").distanceM).toBe(5000);
  });
  it("répétitions et distance combinées (6 × 200 m)", () => {
    const r = parsePrescribedMetrics("6 × 200 m");
    expect(r.reps).toBe(6);
    expect(r.distanceM).toBe(200);
  });
  it("récupération explicite (secondes / minutes)", () => {
    expect(parsePrescribedMetrics("récup 90s").recoverySec).toBe(90);
    expect(parsePrescribedMetrics("récup 2 min").recoverySec).toBe(120);
  });
  it("tenue (mobilité / gainage)", () => {
    expect(parsePrescribedMetrics("tenue 30s").holdSec).toBe(30);
    expect(parsePrescribedMetrics("maintien 1 min").holdSec).toBe(60);
  });
  it("%VMA", () => {
    expect(parsePrescribedMetrics("75% VMA").pctVMA).toBe(75);
    expect(parsePrescribedMetrics("footing 70 % mas").pctVMA).toBe(70);
  });
  it("aucune unité claire → objet vide (jamais de valeur devinée)", () => {
    expect(parsePrescribedMetrics("à l'aise")).toEqual({});
    expect(parsePrescribedMetrics("")).toEqual({});
    expect(parsePrescribedMetrics(null)).toEqual({});
  });
  it("ne parse JAMAIS les kg comme une métrique effort", () => {
    const r = parsePrescribedMetrics("80 kg");
    expect(r.watts).toBeUndefined();
    expect(r.distanceM).toBeUndefined();
    expect(r.durationSec).toBeUndefined();
  });
});
