import { describe, it, expect } from "vitest";
import { quantileSorted, distribution, percentileOf } from "./distribution.js";
import { RELIABILITY } from "./dataQuality.js";

describe("quantileSorted", () => {
  it("interpole les quantiles", () => {
    const s = [1, 2, 3, 4, 5];
    expect(quantileSorted(s, 0)).toBe(1);
    expect(quantileSorted(s, 0.5)).toBe(3);
    expect(quantileSorted(s, 1)).toBe(5);
    expect(quantileSorted(s, 0.25)).toBe(2);
  });
  it("gère un seul point et le vide", () => {
    expect(quantileSorted([7], 0.5)).toBe(7);
    expect(quantileSorted([], 0.5)).toBeNull();
  });
});

describe("distribution (k-anon)", () => {
  it("masque un groupe sous kAnonMin", () => {
    const few = Array.from({ length: RELIABILITY.kAnonMin - 1 }, (_, i) => i + 1);
    const d = distribution(few);
    expect(d.hidden).toBe(true);
    expect(d.n).toBe(RELIABILITY.kAnonMin - 1);
  });
  it("renvoie les quantiles au-delà du seuil", () => {
    const vals = [10, 20, 30, 40, 50]; // n = 5 = kAnonMin
    const d = distribution(vals);
    expect(d.hidden).toBe(false);
    expect(d.n).toBe(5);
    expect(d.min).toBe(10);
    expect(d.median).toBe(30);
    expect(d.max).toBe(50);
    expect(d.mean).toBe(30);
  });
  it("ignore les valeurs non numériques", () => {
    const vals = [10, 20, null, 30, undefined, 40, NaN, 50];
    const d = distribution(vals);
    expect(d.n).toBe(5);
  });
});

describe("percentileOf", () => {
  const group = [10, 20, 30, 40, 50];
  it("up : plus haut est meilleur", () => {
    expect(percentileOf(50, group, "up")).toBe(90); // meilleur que ~90 %
    expect(percentileOf(10, group, "up")).toBe(10);
    expect(percentileOf(30, group, "up")).toBe(50);
  });
  it("down : plus bas est meilleur (ex. Bronco)", () => {
    expect(percentileOf(10, group, "down")).toBe(90); // le plus rapide → top
    expect(percentileOf(50, group, "down")).toBe(10);
  });
  it("renvoie null sans donnée", () => {
    expect(percentileOf(30, [], "up")).toBeNull();
    expect(percentileOf(null, group, "up")).toBeNull();
  });
});
