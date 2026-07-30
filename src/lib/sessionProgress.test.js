import { describe, it, expect } from "vitest";
import { sessionProgress } from "./sessionProgress.js";

describe("sessionProgress — X/Y séries réelles", () => {
  const strengthSession = {
    code: "RS", nature: "force",
    exercises: [
      { id: "e1", name: "Développé couché", sets: 4, reps: "8" },
      { id: "e2", name: "Rowing", sets: 3, reps: "10" },
    ],
  };

  it("aucun log → 0 / total prévu (4+3=7)", () => {
    expect(sessionProgress(strengthSession, null)).toEqual({ done: 0, total: 7 });
  });

  it("log partiel → done = séries cochées, total = séries du log", () => {
    const log = { perExercise: {
      e1: { sets: [{ done: true }, { done: true }, { done: false }, { done: false }] },
      e2: { sets: [{ done: true }, { done: false }, { done: false }] },
    } };
    expect(sessionProgress(strengthSession, log)).toEqual({ done: 3, total: 7 });
  });

  it("repli d'id x{i} quand les exercices n'ont pas d'id", () => {
    const s = { code: "RS", nature: "force", exercises: [{ name: "A", sets: 2, reps: "5" }] };
    const log = { perExercise: { x0: { sets: [{ done: true }, { done: true }] } } };
    expect(sessionProgress(s, log)).toEqual({ done: 2, total: 2 });
  });

  it("séance vide → 0/0", () => {
    expect(sessionProgress({ code: "RS", exercises: [] }, null)).toEqual({ done: 0, total: 0 });
    expect(sessionProgress({ code: "RS" }, null)).toEqual({ done: 0, total: 0 });
  });

  it("plan de reps en séquence (« 5-10-15 ») → 3 séries prévues", () => {
    const s = { code: "RS", nature: "force", exercises: [{ id: "e1", name: "Squat", reps: "5-10-15" }] };
    expect(sessionProgress(s, null)).toEqual({ done: 0, total: 3 });
  });
});
