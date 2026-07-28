import { describe, it, expect } from "vitest";
import { parseChargeKg, prescribedVsRealized, initSetLikeSets } from "./hevy.js";

describe("parseChargeKg", () => {
  it("parses plain and suffixed numbers", () => {
    expect(parseChargeKg("120")).toBe(120);
    expect(parseChargeKg("120 kg")).toBe(120);
    expect(parseChargeKg("120,5")).toBe(120.5);
  });
  it("returns null when not numeric", () => {
    expect(parseChargeKg("")).toBe(null);
    expect(parseChargeKg(null)).toBe(null);
    expect(parseChargeKg("PDC")).toBe(null);
  });
});

const set = (w, reps, done = true, type = "normal") => ({ w, reps, done, type });

describe("prescribedVsRealized", () => {
  const ex = { sets: "4", reps: "5", charge: "120" };

  it("no realized sets → hasRealized false, no diff", () => {
    const r = prescribedVsRealized(ex, { sets: [set("", "", false)] });
    expect(r.hasRealized).toBe(false);
    expect(r.diff).toBe(false);
  });

  it("identical to prescription → no diff", () => {
    const pe = { sets: Array.from({ length: 4 }, () => set(120, 5)) };
    const r = prescribedVsRealized(ex, pe);
    expect(r.hasRealized).toBe(true);
    expect(r.diff).toBe(false);
    expect(r.doneSets).toBe(4);
    expect(r.realTop).toBe(120);
  });

  it("fewer sets and lighter charge → diff with both flags", () => {
    const pe = { sets: [set(80, 5), set(80, 5), set(80, 5)] };
    const r = prescribedVsRealized(ex, pe);
    expect(r.diff).toBe(true);
    expect(r.setsDiff).toBe(true);
    expect(r.chargeDiff).toBe(true);
    expect(r.doneSets).toBe(3);
    expect(r.realTop).toBe(80);
    expect(r.prescCharge).toBe(120);
  });

  it("warmup sets don't count as realized working sets", () => {
    const pe = { sets: [set(60, 5, true, "warmup"), set(120, 5), set(120, 5), set(120, 5), set(120, 5)] };
    const r = prescribedVsRealized(ex, pe);
    expect(r.doneSets).toBe(4);
    expect(r.diff).toBe(false);
  });

  it("non-numeric prescribed charge → no chargeDiff", () => {
    const r = prescribedVsRealized({ sets: "3", reps: "8", charge: "" }, { sets: [set(80, 8), set(80, 8), set(80, 8)] });
    expect(r.chargeDiff).toBe(false);
    expect(r.diff).toBe(false);
  });
});

describe("initSetLikeSets — pré-remplissage du lecteur de séance", () => {
  it("prescription uniforme : SEULE la série 1 reçoit charge + reps, les autres restent vides", () => {
    const { sets } = initSetLikeSets({ sets: "4", reps: "8", charge: "80" });
    expect(sets).toHaveLength(4);
    expect(sets[0]).toMatchObject({ w: "80", reps: "8" });
    // Séries 2..4 : jamais pré-remplies par la prescription.
    for (let i = 1; i < 4; i++) expect(sets[i]).toMatchObject({ w: "", reps: "" });
  });

  it("@% : la charge de la série 1 est calculée depuis le 1RM (série 1 uniquement)", () => {
    const { sets } = initSetLikeSets({ sets: "3", reps: "5", pct: 80 }, { oneRM: 100 });
    expect(sets[0]).toMatchObject({ w: "80", reps: "5" }); // 80% de 100
    expect(sets[1]).toMatchObject({ w: "", reps: "" });
    expect(sets[2]).toMatchObject({ w: "", reps: "" });
  });

  it("exercice SANS @% n'est jamais affecté par le 1RM (charge littérale ou vide)", () => {
    const lit = initSetLikeSets({ sets: "3", reps: "8", charge: "60" }, { oneRM: 200 });
    expect(lit.sets[0]).toMatchObject({ w: "60", reps: "8" }); // littéral, pas 1RM
    const none = initSetLikeSets({ sets: "3", reps: "8" }, { oneRM: 200 });
    expect(none.sets[0]).toMatchObject({ w: "", reps: "8" }); // aucune charge → vide
  });

  it("séries détaillées : chaque série calcule SA valeur une fois, indépendamment", () => {
    const { sets } = initSetLikeSets(
      { setPlan: [{ reps: 10, pct: 80 }, { reps: 8, pct: 85 }, { reps: 6, pct: 90 }] },
      { oneRM: 100 },
    );
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ w: "80", reps: "10" });
    expect(sets[1]).toMatchObject({ w: "85", reps: "8" });
    expect(sets[2]).toMatchObject({ w: "90", reps: "6" });
  });

  it("setPlan @% sans 1RM → charge vide (jamais fabriquée), reps conservées", () => {
    const { sets } = initSetLikeSets({ setPlan: [{ reps: 10, pct: 80 }, { reps: 8, pct: 85 }] }, { oneRM: null });
    expect(sets[0]).toMatchObject({ w: "", reps: "10" });
    expect(sets[1]).toMatchObject({ w: "", reps: "8" });
  });

  it("la saisie enregistrée (saved) est restituée TELLE QUELLE — jamais recalculée", () => {
    const saved = { sets: [{ w: "85", reps: "6", type: "normal", done: true }, { w: "82.5", reps: "6", type: "normal", done: true }], note: "dur" };
    const { sets, note } = initSetLikeSets({ sets: "4", reps: "8", pct: 80 }, { saved, oneRM: 100 });
    expect(note).toBe("dur");
    expect(sets).toHaveLength(2); // structure du réalisé (2 séries) ≠ prescrit (4) — l'écart est simplement affiché
    expect(sets[0]).toMatchObject({ w: "85", reps: "6" });
    expect(sets[1]).toMatchObject({ w: "82.5", reps: "6" });
  });

  it("exercices distincts : le pré-remplissage de l'un n'affecte pas l'autre", () => {
    const a = initSetLikeSets({ sets: "3", reps: "8", charge: "100" });
    const b = initSetLikeSets({ sets: "2", reps: "5", charge: "60" });
    expect(a.sets[0].w).toBe("100");
    expect(b.sets[0].w).toBe("60");
    expect(b.sets).toHaveLength(2);
  });
});
