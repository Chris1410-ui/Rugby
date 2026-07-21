import { describe, it, expect } from "vitest";
import { normalizeFreeExercises, createFreeSession } from "./freeSessions.js";

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
