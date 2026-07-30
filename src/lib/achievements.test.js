import { describe, it, expect } from "vitest";
import { monthCoverage, weeklyLoggedSets, deriveAchievements } from "./achievements.js";

const T = "2026-07-30"; // 30 jours écoulés en juillet

describe("achievements — récompenses dérivées", () => {
  it("monthCoverage : jours distincts avec saisie / jours écoulés du mois", () => {
    const cks = Array.from({ length: 27 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, moment: "matin" }));
    expect(monthCoverage(cks, T)).toBeCloseTo(27 / 30, 5); // 0.9
    expect(monthCoverage(cks, T) >= 0.9).toBe(true);
    // ignore les jours d'un autre mois
    expect(monthCoverage([{ date: "2026-06-15", moment: "matin" }], T)).toBe(0);
  });

  it("weeklyLoggedSets : séries cochées sur 7 jours glissants", () => {
    const sessions = [
      { id: "s1", date: "2026-07-30", code: "RS", nature: "force", exercises: [{ id: "e1", name: "A", sets: 3, reps: "8" }] },
      { id: "s2", date: "2026-07-20", code: "RS", nature: "force", exercises: [{ id: "e1", name: "A", sets: 3, reps: "8" }] }, // hors fenêtre
    ];
    const logs = {
      s1: { p1: { perExercise: { e1: { sets: [{ done: true }, { done: true }, { done: false }] } } } },
      s2: { p1: { perExercise: { e1: { sets: [{ done: true }, { done: true }, { done: true }] } } } },
    };
    expect(weeklyLoggedSets(sessions, logs, "p1", T)).toBe(2); // seule s1 compte
  });

  it("deriveAchievements : chaque seuil déclenche sa récompense", () => {
    // 27 jours consécutifs (4→30 juillet) : streak ≥ 7 ET couverture 27/30 = 0,9.
    const full = Array.from({ length: 27 }, (_, i) => ({ date: `2026-07-${String(30 - i).padStart(2, "0")}`, moment: "matin" }));
    const earned = deriveAchievements({ checkins: full, oneRMCount: 1, gpsCount: 1, weeklySets: 100, todayIso: T });
    expect([...earned].sort()).toEqual(["firstRecord", "gpsImport", "monthComplete", "sets100", "wellness7"].sort());
  });

  it("deriveAchievements : rien d'acquis quand les seuils ne sont pas atteints", () => {
    const earned = deriveAchievements({ checkins: [], oneRMCount: 0, gpsCount: 0, weeklySets: 99, todayIso: T });
    expect(earned.size).toBe(0);
  });

  it("deriveAchievements : streak de 6 jours n'ouvre pas Bien-être 7 j", () => {
    const streak6 = Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-${String(30 - i).padStart(2, "0")}`, moment: "matin" }));
    expect(deriveAchievements({ checkins: streak6, todayIso: T }).has("wellness7")).toBe(false);
  });
});
