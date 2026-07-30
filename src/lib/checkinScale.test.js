import { describe, it, expect } from "vitest";
import {
  clampQuick, quickToLevel, quickToWb, quickCheckinPayload,
  wbToQuick, isQuickCheckin, checkinStreak,
} from "./checkinScale.js";
import { wbToWellness, computeReadiness } from "./metrics.js";

describe("checkinScale — geste 1–5 ⇄ marqueurs", () => {
  it("clampQuick borne sur [1..5] et arrondit", () => {
    expect(clampQuick(0)).toBe(1);
    expect(clampQuick(9)).toBe(5);
    expect(clampQuick(3.4)).toBe(3);
    expect(clampQuick("4")).toBe(4);
    expect(clampQuick(NaN)).toBe(1);
  });

  it("quickToLevel : 1→2, 2→4, 3→6, 4→8, 5→10", () => {
    expect([1, 2, 3, 4, 5].map(quickToLevel)).toEqual([2, 4, 6, 8, 10]);
  });

  it("quickToWb : marqueurs positifs = L, marqueurs à rebours = 10−L, quick mémorisé", () => {
    const wb = quickToWb(4);
    expect(wb).toMatchObject({ energy: 8, mood: 8, sleep: 8, fatigue: 2, soreness: 2, stress: 2, quick: 4 });
  });

  it("quickToWb fusionne la base sans perdre les clés annexes", () => {
    const wb = quickToWb(5, { note: "x", energy: 1 });
    expect(wb.note).toBe("x");
    expect(wb.energy).toBe(10); // le geste écrase la valeur de base
  });

  it("wellness produit par le geste est monotone et couvre coral→vert", () => {
    const wells = [1, 2, 3, 4, 5].map((v) => wbToWellness(quickToWb(v), null));
    // strictement croissant
    for (let i = 1; i < wells.length; i++) expect(wells[i]).toBeGreaterThan(wells[i - 1]);
    expect(wells[0]).toBeLessThan(20);   // « vidé » → readiness coral
    expect(wells[4]).toBe(50);           // « à bloc » → wellness plein
  });

  it("readiness dérivé du geste (sleep_h null) reste dans les bornes et croît", () => {
    const risque = 30;
    const rs = [1, 2, 3, 4, 5].map((v) => computeReadiness(wbToWellness(quickToWb(v), null), risque, null));
    for (let i = 1; i < rs.length; i++) expect(rs[i]).toBeGreaterThan(rs[i - 1]);
    expect(rs[0]).toBeLessThan(70);      // coral/ambre
    expect(rs[4]).toBeGreaterThan(70);   // vert
  });

  it("quickCheckinPayload préserve sleep_h / hydra / activités déjà saisis", () => {
    const prev = { wb: { quick: 2 }, sleepH: 8, hydra: 2.5, activities: ["salle"], poids: 82 };
    const p = quickCheckinPayload(5, prev);
    expect(p.sleepH).toBe(8);
    expect(p.hydra).toBe(2.5);
    expect(p.activities).toEqual(["salle"]);
    expect(p.poids).toBe(82);
    expect(p.wb.quick).toBe(5);
    expect(p.wb.energy).toBe(10);
  });

  it("quickCheckinPayload sans historique → défauts neutres, sleep_h null", () => {
    const p = quickCheckinPayload(3, null);
    expect(p.sleepH).toBeNull();
    expect(p.hydra).toBe(2.0);
    expect(p.activities).toEqual([]);
    expect(p.wb.quick).toBe(3);
  });

  it("wbToQuick : restitue quick s'il existe, sinon estime depuis energy/mood", () => {
    expect(wbToQuick(quickToWb(4))).toBe(4);
    expect(wbToQuick({ energy: 8, mood: 8 })).toBe(4); // détaillé sans quick
    expect(wbToQuick(null)).toBeNull();
    expect(wbToQuick({})).toBeNull();
  });

  it("isQuickCheckin distingue geste vs formulaire détaillé", () => {
    expect(isQuickCheckin(quickToWb(3))).toBe(true);
    expect(isQuickCheckin({ energy: 6, mood: 7 })).toBe(false);
    expect(isQuickCheckin(null)).toBe(false);
  });
});

describe("checkinStreak — jours consécutifs de bilan matin", () => {
  const T = "2026-07-30";
  it("compte aujourd'hui + jours consécutifs précédents", () => {
    const cks = [
      { date: "2026-07-30", moment: "matin" },
      { date: "2026-07-29", moment: "matin" },
      { date: "2026-07-28", moment: "matin" },
    ];
    expect(checkinStreak(cks, T)).toBe(3);
  });

  it("grâce jour en cours : aujourd'hui pas encore fait mais hier oui → série d'hier", () => {
    const cks = [
      { date: "2026-07-29", moment: "matin" },
      { date: "2026-07-28", moment: "matin" },
    ];
    expect(checkinStreak(cks, T)).toBe(2);
  });

  it("trou → série cassée", () => {
    const cks = [
      { date: "2026-07-30", moment: "matin" },
      { date: "2026-07-28", moment: "matin" }, // 29 manquant
    ];
    expect(checkinStreak(cks, T)).toBe(1);
  });

  it("ignore les lignes soir/meditation", () => {
    const cks = [
      { date: "2026-07-30", moment: "soir" },
      { date: "2026-07-30", moment: "meditation" },
    ];
    expect(checkinStreak(cks, T)).toBe(0);
  });

  it("aucun bilan récent → 0", () => {
    expect(checkinStreak([{ date: "2026-07-10", moment: "matin" }], T)).toBe(0);
    expect(checkinStreak([], T)).toBe(0);
  });
});
