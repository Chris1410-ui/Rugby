import { describe, it, expect } from "vitest";
import { shakeProtein, routineComplete, DEFAULT_SHAKE, DEFAULT_ROUTINE_ITEMS } from "./morningRoutine.js";

describe("shakeProtein", () => {
  it("somme quantité × protéines/unité", () => {
    const shake = [
      { qty: 30, proteinPer: 0.8 }, // 24
      { qty: 1, proteinPer: 1.3 },  // 1.3
      { qty: 2, proteinPer: 1 },    // 2
      { qty: 5, proteinPer: 0 },    // 0
    ];
    expect(shakeProtein(shake)).toBe(27); // arrondi
  });
  it("null-safe", () => {
    expect(shakeProtein(null)).toBe(0);
    expect(shakeProtein([{}, { qty: "x", proteinPer: 2 }])).toBe(0);
  });
  it("le shake par défaut a un total protéines cohérent", () => {
    expect(shakeProtein(DEFAULT_SHAKE())).toBeGreaterThan(20);
  });
});

describe("routineComplete", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("vrai seulement si tous les items sont cochés", () => {
    expect(routineComplete(["a", "b", "c"], items)).toBe(true);
    expect(routineComplete(["a", "b"], items)).toBe(false);
    expect(routineComplete([], items)).toBe(false);
  });
  it("faux si aucun item (liste vide)", () => {
    expect(routineComplete(["a"], [])).toBe(false);
  });
  it("la liste par défaut n'est pas vide", () => {
    expect(DEFAULT_ROUTINE_ITEMS().length).toBeGreaterThan(0);
  });
});
