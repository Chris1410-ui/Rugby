import { describe, it, expect } from "vitest";
import { weekdayDatesInRange, aggregateLoadByDate, overlapForWeekday } from "./overload.js";

describe("anti-surcharge — helpers", () => {
  it("weekdayDatesInRange : toutes les occurrences d'un weekday dans la plage", () => {
    // 2026-07-06 = lundi. Lundis jusqu'au 2026-07-20 : 06, 13, 20.
    const d = weekdayDatesInRange("2026-07-06", "2026-07-20", 1);
    expect(d).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
  });

  it("weekdayDatesInRange : plage invalide → vide", () => {
    expect(weekdayDatesInRange("2026-07-20", "2026-07-06", 1)).toEqual([]);
    expect(weekdayDatesInRange("", "2026-07-06", 1)).toEqual([]);
  });

  it("aggregateLoadByDate : compte par date × nature pour les seuls destinataires", () => {
    const sessions = [
      { date: "2026-07-06", nature: "force", code: "RS", assignedIds: ["p1", "p2"] },
      { date: "2026-07-06", nature: null, code: "CSB", assignedIds: ["p1"] },     // nature dérivée → conditioning
      { date: "2026-07-06", nature: "force", code: "RS", assignedIds: ["p9"] },   // hors périmètre → ignoré
      { date: "2026-07-13", nature: "force", code: "RS", assignedIds: ["p2"] },
      { date: "2026-06-01", nature: "force", code: "RS", assignedIds: ["p1"] },   // hors plage → ignoré
    ];
    const load = aggregateLoadByDate(sessions, new Set(["p1", "p2"]), "2026-07-06", "2026-07-31");
    expect(load).toEqual({
      "2026-07-06": { force: 1, conditioning: 1 },
      "2026-07-13": { force: 1 },
    });
  });

  it("aggregateLoadByDate : périmètre vide → rien", () => {
    const sessions = [{ date: "2026-07-06", nature: "force", code: "RS", assignedIds: ["p1"] }];
    expect(aggregateLoadByDate(sessions, new Set(), "2026-07-06", "2026-07-31")).toEqual({});
  });

  it("overlapForWeekday : détecte l'empilement de même nature + totaux", () => {
    const load = {
      "2026-07-06": { force: 1, conditioning: 1 },
      "2026-07-13": { force: 2 },
      "2026-07-20": { recuperation: 1 },
    };
    const dates = ["2026-07-06", "2026-07-13", "2026-07-20"];
    const r = overlapForWeekday(dates, load, "force");
    expect(r.sameNature).toBe(3);       // 1 + 2
    expect(r.sameNatureDays).toBe(2);   // 06 et 13
    expect(r.busyDays).toBe(3);         // les 3 jours ont une activité
    expect(r.natTotals).toEqual({ force: 3, conditioning: 1, recuperation: 1 });
  });

  it("overlapForWeekday : aucune charge → tout à zéro", () => {
    const r = overlapForWeekday(["2026-07-06"], {}, "force");
    expect(r).toEqual({ sameNature: 0, sameNatureDays: 0, busyDays: 0, natTotals: {} });
  });
});
