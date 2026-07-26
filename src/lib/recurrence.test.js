import { describe, it, expect } from "vitest";
import { expandRecurrence, isoWeekday, summarizeDays, MAX_OCCURRENCES } from "./recurrence.js";

describe("recurrence — isoWeekday (1=lundi..7=dimanche)", () => {
  it("mappe correctement", () => {
    expect(isoWeekday(new Date(2026, 8, 1))).toBe(2); // 1 sept 2026 = mardi
    expect(isoWeekday(new Date(2026, 8, 6))).toBe(7); // 6 sept 2026 = dimanche
  });
});

describe("recurrence — expandRecurrence", () => {
  it("mode ponctuel → une seule occurrence", () => {
    const r = expandRecurrence({ mode: "once", date: "2026-09-01", time: "18:30" });
    expect(r.occurrences).toEqual([{ date: "2026-09-01", time: "18:30" }]);
  });

  it("mardi + jeudi sur une période → occurrences aux bons jours + heures", () => {
    const r = expandRecurrence({
      mode: "recurring", weekdays: [2, 4], times: { 2: "18:30", 4: "20:00" },
      start: "2026-09-01", end: "2026-09-14", exclusions: [],
    });
    // 1,3,8,10 sept (ma/je) + 15... hors borne → 1,3,8,10
    expect(r.occurrences.map((o) => o.date)).toEqual(["2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10"]);
    expect(r.occurrences[0].time).toBe("18:30"); // mardi
    expect(r.occurrences[1].time).toBe("20:00"); // jeudi
    expect(r.count).toBe(4);
  });

  it("exclut les dates de la liste (vacances/trêve)", () => {
    const r = expandRecurrence({
      mode: "recurring", weekdays: [2], times: { 2: "18:30" },
      start: "2026-09-01", end: "2026-09-30", exclusions: ["2026-09-08", "2026-09-22"],
    });
    expect(r.occurrences.map((o) => o.date)).toEqual(["2026-09-01", "2026-09-15", "2026-09-29"]);
  });

  it("borne à MAX_OCCURRENCES + drapeau capped", () => {
    const r = expandRecurrence({
      mode: "recurring", weekdays: [1, 2, 3, 4, 5, 6, 7], times: {},
      start: "2026-01-01", end: "2027-12-31", exclusions: [],
    }, 200);
    expect(r.count).toBe(200);
    expect(r.capped).toBe(true);
    expect(MAX_OCCURRENCES).toBe(200);
  });

  it("définition invalide (aucun jour / période inversée) → vide", () => {
    expect(expandRecurrence({ mode: "recurring", weekdays: [], start: "2026-09-01", end: "2026-09-30" }).count).toBe(0);
    expect(expandRecurrence({ mode: "recurring", weekdays: [2], start: "2026-09-30", end: "2026-09-01" }).count).toBe(0);
  });

  it("summarizeDays → « Mardi 18:30 · Jeudi 20:00 »", () => {
    const labels = { 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi", 7: "Dimanche" };
    const s = summarizeDays({ weekdays: [4, 2], times: { 2: "18:30", 4: "20:00" } }, labels);
    expect(s).toBe("Mardi 18:30 · Jeudi 20:00");
  });
});
