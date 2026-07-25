import { describe, it, expect } from "vitest";
import { numLead, prescPct, perfFromSets, adhered, perfRowsFromLog } from "./exercisePerf.js";

describe("numLead", () => {
  it("extrait la valeur numérique de tête d'une saisie libre", () => {
    expect(numLead("10 kg")).toBe(10);
    expect(numLead("30 s")).toBe(30);
    expect(numLead("12 ")).toBe(12);
    expect(numLead("10kg ")).toBe(10);
    expect(numLead("7,5")).toBe(7.5);
  });
  it("renvoie null sur une saisie vide ou non numérique", () => {
    expect(numLead("")).toBeNull();
    expect(numLead(null)).toBeNull();
    expect(numLead(undefined)).toBeNull();
    expect(numLead("kg")).toBeNull();
  });
});

describe("prescPct", () => {
  it("lit le % dans les deux ordres, sinon null", () => {
    expect(prescPct("@70%")).toBe(70);
    expect(prescPct("70%@")).toBe(70);
    expect(prescPct("6 @ 80 %")).toBe(80);
    expect(prescPct("4×6")).toBeNull();
    expect(prescPct("")).toBeNull();
  });
});

describe("perfFromSets", () => {
  it("agrège top charge, volume et 1RM sur les séries de travail (Epley)", () => {
    const pe = { sets: [
      { w: "10 kg", reps: "12 ", type: "normal", done: false },
      { w: "10 kg", reps: "12 ", type: "normal", done: false },
      { w: "10 kg", reps: "12 ", type: "normal", done: false },
    ] };
    // volume = 3 × 10 × 12 = 360 ; e1RM = round(10×(1+12/30)) = 14
    expect(perfFromSets(pe)).toEqual({ topKg: 10, volumeKg: 360, est1rm: 14, doneSets: 3 });
  });
  it("ne filtre PAS sur set.done (drapeau non fiable dans les vrais logs)", () => {
    const pe = { sets: [{ w: "40", reps: "5", type: "normal", done: false }] };
    expect(perfFromSets(pe).doneSets).toBe(1);
  });
  it("exclut l'échauffement des agrégats", () => {
    const pe = { sets: [
      { w: "20", reps: "10", type: "warmup" },
      { w: "50", reps: "5", type: "normal" },
    ] };
    expect(perfFromSets(pe)).toEqual({ topKg: 50, volumeKg: 250, est1rm: 58, doneSets: 1 });
  });
  it("poids du corps : charge nulle mais séries comptées", () => {
    const pe = { sets: [
      { w: "", reps: "20", type: "normal" },
      { w: "", reps: "20", type: "normal" },
    ] };
    expect(perfFromSets(pe)).toEqual({ topKg: null, volumeKg: null, est1rm: 0, doneSets: 2 });
  });
  it("série totalement vide ignorée", () => {
    const pe = { sets: [{ w: "", reps: "", type: "normal" }] };
    expect(perfFromSets(pe).doneSets).toBe(0);
  });
  it("robuste à l'absence de sets", () => {
    expect(perfFromSets({})).toEqual({ topKg: null, volumeKg: null, est1rm: 0, doneSets: 0 });
    expect(perfFromSets(null)).toEqual({ topKg: null, volumeKg: null, est1rm: 0, doneSets: 0 });
  });
});

describe("adhered", () => {
  it("vrai si prescription absente ou séries réalisées suffisantes", () => {
    expect(adhered(3, 3)).toBe(true);
    expect(adhered(4, 3)).toBe(true);
    expect(adhered(2, 3)).toBe(false);
    expect(adhered(1, null)).toBe(true);
  });
});

describe("perfRowsFromLog", () => {
  const sessionExercises = [
    { id: "a1", name: "Back squat", sets: "3", reps: "5 @80%" },
    { id: "a2", name: "Neck curl + bridge", sets: 3, reps: "20" },
  ];
  const perExercise = {
    a1: { sets: [
      { w: "100", reps: "5", type: "normal" },
      { w: "100", reps: "5", type: "normal" },
    ] },
    a2: { sets: [
      { w: "", reps: "20", type: "normal" },
      { w: "", reps: "20", type: "normal" },
      { w: "", reps: "20", type: "normal" },
    ] },
  };

  it("recompose des lignes alignées sur exercise_perf", () => {
    const rows = perfRowsFromLog(perExercise, sessionExercises);
    const squat = rows.find((r) => r.exerciseName === "Back squat");
    expect(squat).toMatchObject({
      exerciseKey: "backsquat", topKg: 100, volumeKg: 1000, est1rm: 117,
      prescSets: 3, doneSets: 2, prescPct: 80, adhered: false,
    });
    const neck = rows.find((r) => r.exerciseName === "Neck curl + bridge");
    expect(neck).toMatchObject({
      topKg: null, volumeKg: null, prescSets: 3, doneSets: 3, prescPct: null, adhered: true,
    });
  });

  it("ignore les exercices sans série réalisée", () => {
    const rows = perfRowsFromLog({ a1: { sets: [{ w: "", reps: "", type: "normal" }] } }, sessionExercises);
    expect(rows).toHaveLength(0);
  });

  it("robuste aux entrées vides", () => {
    expect(perfRowsFromLog(null, null)).toEqual([]);
    expect(perfRowsFromLog({}, [])).toEqual([]);
  });
});
