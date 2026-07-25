import { describe, it, expect } from "vitest";
import { parseProgressionCell, roundToIncrement, computeLoadKg, estimate1RM, movementIdentity, summarize1RM } from "./oneRM.js";

describe("parseProgressionCell", () => {
  it("reconnaît sets×reps + @xx% + ★", () => {
    expect(parseProgressionCell("4×6 @75% ★")).toMatchObject({ sets: "4", reps: "6", pct: 75, star: true, abs: null });
  });
  it("charge absolue conservée (pas de pourcentage)", () => {
    expect(parseProgressionCell("4×8 @100kg")).toMatchObject({ sets: "4", reps: "8", pct: null, abs: "100kg" });
    expect(parseProgressionCell("3×5 80 kg")).toMatchObject({ pct: null, abs: "80kg" });
  });
  it("le pourcentage n'est jamais confondu avec une charge absolue", () => {
    expect(parseProgressionCell("5×5 @82.5%")).toMatchObject({ pct: 82.5, abs: null });
  });
  it("cellule sans schéma → champs vides, pas de crash", () => {
    expect(parseProgressionCell("")).toMatchObject({ sets: "", reps: "", pct: null, abs: null });
  });
});

describe("roundToIncrement / computeLoadKg", () => {
  it("arrondit à 2,5 kg par défaut", () => {
    expect(roundToIncrement(83.6)).toBe(82.5);
    expect(roundToIncrement(84)).toBe(85);
    expect(roundToIncrement(84, 1.25)).toBe(83.75);
    expect(roundToIncrement(84, 5)).toBe(85);
  });
  it("charge = 1RM × % arrondie", () => {
    expect(computeLoadKg(70, 120)).toBe(85);   // 84 → 85 (2,5)
    expect(computeLoadKg(80, 120)).toBe(95);   // 96 → 95 (nearest 2,5)
    expect(computeLoadKg(85, 100)).toBe(85);   // 85 exact
  });
  it("1RM manquant ou % nul → null (jamais 0 ni charge fausse)", () => {
    expect(computeLoadKg(70, 0)).toBeNull();
    expect(computeLoadKg(70, null)).toBeNull();
    expect(computeLoadKg(0, 120)).toBeNull();
  });
});

describe("estimate1RM (Epley réutilisé)", () => {
  it("estime le 1RM depuis un sous-max", () => {
    expect(estimate1RM(100, 5)).toBe(Math.round(100 * (1 + 5 / 30))); // 117
    expect(estimate1RM(120, 1)).toBe(124);
  });
});

describe("movementIdentity — anti-doublon", () => {
  it("privilégie exercise_id, sinon la clé normalisée du nom", () => {
    expect(movementIdentity({ exerciseId: "abc" })).toBe("ex:abc");
    expect(movementIdentity({ name: "Hip thrust" })).toBe(movementIdentity({ name: "hip-thrust" }));
    expect(movementIdentity({ name: "Hip thrust" })).not.toBe(movementIdentity({ name: "Back squat" }));
  });
});

describe("summarize1RM — courant + historique + manquants", () => {
  const entries = [
    { movementLabel: "Back Squat", valueKg: 120, kind: "teste", measuredAt: "2026-01-10", createdAt: "2026-01-10" },
    { movementLabel: "back squat", valueKg: 130, kind: "teste", measuredAt: "2026-03-01", createdAt: "2026-03-01" }, // plus récent, même mouvement
    { movementLabel: "Hip thrust", valueKg: null, kind: "auto", measuredAt: null, createdAt: "2026-02-01" },          // placeholder
  ];
  it("regroupe par mouvement, prend la mesure la plus récente comme courant", () => {
    const s = summarize1RM(entries);
    const squat = s.find((x) => x.label.toLowerCase() === "back squat" || x.identity.includes("back"));
    // les deux « Back Squat » fusionnent (même clé) → courant = 130
    const sq = s.find((x) => x.value === 130);
    expect(sq).toBeTruthy();
    expect(sq.history).toHaveLength(2);       // historique conservé
    expect(sq.missing).toBe(false);
    expect(squat).toBeTruthy();
  });
  it("un placeholder sans mesure → missing = true", () => {
    const s = summarize1RM(entries);
    const hip = s.find((x) => x.label === "Hip thrust");
    expect(hip.missing).toBe(true);
    expect(hip.value).toBeNull();
  });
});
