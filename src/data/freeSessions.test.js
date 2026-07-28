import { describe, it, expect } from "vitest";
import { normalizeFreeExercises, createFreeSession, expandProgramToRows } from "./freeSessions.js";

describe("import PDF joueur — expandProgramToRows", () => {
  it("développe chaque séance sur N semaines à partir de la 1re occurrence du jour", () => {
    // 2026-07-06 = lundi. Séance lundi (weekday 1) sur 3 semaines.
    const rows = expandProgramToRows(
      [{ weekday: 1, code: "RS", nature: "force", titre: "Force", exercises: [{ name: "Squat", sets: 4, reps: "8" }] }],
      "2026-07-06", 3);
    expect(rows.map((r) => r.date)).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
    expect(rows[0]).toMatchObject({ code: "RS", nature: "force", titre: "Force" });
    expect(rows[0].exercises[0]).toMatchObject({ name: "Squat", sets: 4, reps: "8" });
  });

  it("cale la 1re séance sur le premier jour >= startDate correspondant au weekday", () => {
    // start mardi 2026-07-07 ; séance jeudi (4) → premier jeudi = 2026-07-09.
    const rows = expandProgramToRows(
      [{ weekday: 4, code: "RS", titre: "S", exercises: [{ name: "Sprint" }] }],
      "2026-07-07", 1);
    expect(rows[0].date).toBe("2026-07-09");
  });

  it("ignore les séances sans exercice ; borne les semaines à [1,12]", () => {
    expect(expandProgramToRows([{ weekday: 1, exercises: [] }], "2026-07-06", 4)).toEqual([]);
    const rows = expandProgramToRows([{ weekday: 1, exercises: [{ name: "Squat" }] }], "2026-07-06", 99);
    expect(rows.length).toBe(12);
  });
});

describe("séances libres — normalizeFreeExercises", () => {
  it("applique des valeurs par défaut saines et un id", () => {
    const [e] = normalizeFreeExercises([{ ref: "0001", name: "Squat" }]);
    expect(e.name).toBe("Squat");
    expect(e.sets).toBe(3);
    expect(e.reps).toBe("8");
    expect(e.charge).toBe("");
    expect(e.rest).toBe(90);
    expect(e.ref).toBe("0001");
    expect(typeof e.id).toBe("string");
  });
  it("conserve les valeurs fournies et nettoie les nombres", () => {
    const [e] = normalizeFreeExercises([{ name: "Bench", sets: 5, reps: "5", charge: "80", rest: 120 }]);
    expect(e.sets).toBe(5);
    expect(e.reps).toBe("5");
    expect(e.charge).toBe("80");
    expect(e.rest).toBe(120);
  });
  it("ignore les entrées sans nom", () => {
    expect(normalizeFreeExercises([{ name: "  " }, null, { name: "Deadlift" }])).toHaveLength(1);
  });
  it("un item sans kind = force (rétro-compat) et porte kind:'strength'", () => {
    const [e] = normalizeFreeExercises([{ name: "Squat" }]);
    expect(e.kind).toBe("strength");
  });
});

describe("séances libres — dispatch par kind (PR2)", () => {
  it("bodyweight : pas de charge ; le lest optionnel va dans charge (kg)", () => {
    const [a] = normalizeFreeExercises([{ kind: "bodyweight", name: "Traction", sets: 4, reps: "6" }]);
    expect(a).toMatchObject({ kind: "bodyweight", sets: 4, reps: "6", charge: "" });
    const [b] = normalizeFreeExercises([{ kind: "bodyweight", name: "Traction", lest: "10", lestOn: true }]);
    expect(b.charge).toBe("10");
  });

  it("skill : reps par défaut, ou tenue (temps) sans reps", () => {
    const [r] = normalizeFreeExercises([{ kind: "skill", name: "Pistol" }]);
    expect(r).toMatchObject({ kind: "skill", measure: "reps", reps: "8", holdSec: null });
    const [h] = normalizeFreeExercises([{ kind: "skill", name: "Handstand", measure: "temps", holdSec: 30 }]);
    expect(h).toMatchObject({ measure: "temps", holdSec: 30, reps: null });
  });

  it("cardio_continuous : gardé si distance OU durée, sinon écarté", () => {
    const [c] = normalizeFreeExercises([{ kind: "cardio_continuous", name: "Footing", distanceM: 5000, pctVMA: 65 }]);
    expect(c).toMatchObject({ kind: "cardio_continuous", distanceM: 5000, durationSec: null, pctVMA: 65 });
    expect(normalizeFreeExercises([{ kind: "cardio_continuous", name: "Vide" }])).toHaveLength(0);
  });

  it("cardio_interval : gardé si reps + effort, sinon écarté", () => {
    const [i] = normalizeFreeExercises([{ kind: "cardio_interval", reps: 10, effort: { durationSec: 30 }, recovery: { durationSec: 30 }, pctVMA: 100 }]);
    expect(i).toMatchObject({ kind: "cardio_interval", reps: 10, effort: { durationSec: 30 }, recovery: { durationSec: 30 }, pctVMA: 100 });
    expect(i.repPlan).toBeUndefined();
    expect(normalizeFreeExercises([{ kind: "cardio_interval", reps: 10 }])).toHaveLength(0);
  });

  it("cardio_interval : repPlan (variation par répétition) normalisé, effort requis par rép", () => {
    const [i] = normalizeFreeExercises([{ kind: "cardio_interval", reps: 2, effort: { distanceM: 200 }, repPlan: [
      { effort: { distanceM: 200 }, recovery: { durationSec: 90 }, pctVMA: 100 },
      { effort: { distanceM: 200 }, recovery: { durationSec: 120 }, pctVMA: 95 },
      { recovery: { durationSec: 60 } }, // sans effort → écarté
    ] }]);
    expect(i.repPlan).toHaveLength(2);
    expect(i.repPlan[1]).toEqual({ effort: { distanceM: 200 }, recovery: { durationSec: 120 }, pctVMA: 95 });
  });

  it("cardio_circuit : mode normalisé + items du tour filtrés", () => {
    const [c] = normalizeFreeExercises([{ kind: "cardio_circuit", mode: "amrap", totalDurationSec: 600, roundItems: [{ name: "Burpee", reps: 10 }, { name: "" }] }]);
    expect(c).toMatchObject({ kind: "cardio_circuit", mode: "amrap", totalDurationSec: 600 });
    expect(c.roundItems).toHaveLength(1);
  });

  it("cardio_test : gardé si testKey, sinon écarté", () => {
    const [tst] = normalizeFreeExercises([{ kind: "cardio_test", testKey: "bronco" }]);
    expect(tst).toMatchObject({ kind: "cardio_test", testKey: "bronco" });
    expect(normalizeFreeExercises([{ kind: "cardio_test" }])).toHaveLength(0);
  });

  it("panier hétérogène (mixte) : chaque bloc garde son kind et l'ordre", () => {
    const out = normalizeFreeExercises([
      { kind: "strength", name: "Squat", charge: "80" },
      { kind: "cardio_interval", reps: 8, effort: { distanceM: 200 } },
    ]);
    expect(out.map((e) => e.kind)).toEqual(["strength", "cardio_interval"]);
  });

  it("panier mixte complet (7 kinds depuis les formes du builder)", () => {
    const out = normalizeFreeExercises([
      { kind: "strength", name: "Squat", sets: "4", reps: "5", charge: "90" },
      { kind: "bodyweight", name: "Traction", sets: "3", reps: "8", lest: "10" },
      { kind: "skill", name: "Handstand", sets: "3", measure: "temps", holdSec: "30" },
      { kind: "cardio_continuous", name: "Footing", distanceM: "3000", pctVMA: "65" },
      { kind: "cardio_interval", name: "30-30", reps: "10", effort: { durationSec: 30 }, recovery: { durationSec: 30 } },
      { kind: "cardio_circuit", mode: "amrap", totalDurationSec: 600, roundItems: [{ name: "Burpee", reps: "10" }] },
      { kind: "cardio_test", testKey: "bronco" },
    ]);
    expect(out.map((e) => e.kind)).toEqual([
      "strength", "bodyweight", "skill", "cardio_continuous", "cardio_interval", "cardio_circuit", "cardio_test",
    ]);
    expect(out[1].charge).toBe("10"); // lest → charge
    expect(out[2]).toMatchObject({ measure: "temps", holdSec: 30 });
    expect(out[5].roundItems).toHaveLength(1);
  });
});

describe("séances libres — createFreeSession", () => {
  it("refuse un panier vide AVANT tout accès réseau", async () => {
    await expect(createFreeSession({ title: "x", exercises: [] })).rejects.toThrow("NO_EXERCISE");
    await expect(createFreeSession({ title: "x", exercises: [{ name: " " }] })).rejects.toThrow("NO_EXERCISE");
  });
});
