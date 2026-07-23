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
});

describe("séances libres — createFreeSession", () => {
  it("refuse un panier vide AVANT tout accès réseau", async () => {
    await expect(createFreeSession({ title: "x", exercises: [] })).rejects.toThrow("NO_EXERCISE");
    await expect(createFreeSession({ title: "x", exercises: [{ name: " " }] })).rejects.toThrow("NO_EXERCISE");
  });
});
