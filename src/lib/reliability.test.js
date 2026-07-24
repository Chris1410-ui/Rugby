import { describe, it, expect } from "vitest";
import { readinessReady, acwrReliable, acwrEstimated, ACWR_MIN_LOGS_28, ACWR_MIN_LOGS_7 } from "./reliability.js";

// Construit un _load.hist de 28 jours ; les `realDays` derniers jours sont réels
// (real:true), et on force `acuteReal` jours réels dans la dernière semaine.
function player({ live = false, realIn28 = 0, realIn7 = 0 } = {}) {
  const hist = Array.from({ length: 28 }, (_, i) => ({ date: `d${i}`, au: 100, real: false }));
  // Marque des jours réels dans la fenêtre chronique (jours 0..20) puis aiguë (21..27).
  for (let i = 0; i < realIn28 - realIn7 && i < 21; i++) hist[i].real = true;
  for (let i = 0; i < realIn7; i++) hist[21 + i].real = true;
  return { _live: live, _load: { hist } };
}

describe("readinessReady", () => {
  it("vrai seulement si un bilan du matin réel existe (_live)", () => {
    expect(readinessReady({ _live: true })).toBe(true);
    expect(readinessReady({ _live: false })).toBe(false);
    expect(readinessReady(null)).toBe(false);
    expect(readinessReady({})).toBe(false);
  });
});

describe("acwrReliable — seuil 6/28 + ≥1/7", () => {
  it("estimé sans aucun log (cas seed pur)", () => {
    const p = player({ realIn28: 0, realIn7: 0 });
    expect(acwrReliable(p)).toBe(false);
    expect(acwrEstimated(p)).toBe(true);
  });

  it("estimé si assez de logs sur 28 j mais aucun sur la semaine aiguë", () => {
    const p = player({ realIn28: 6, realIn7: 0 });
    expect(acwrReliable(p)).toBe(false);
  });

  it("estimé si < 6 logs sur 28 j même avec un log récent", () => {
    const p = player({ realIn28: 5, realIn7: 1 });
    expect(acwrReliable(p)).toBe(false);
  });

  it("réel dès 6 logs sur 28 j dont ≥ 1 sur 7 j", () => {
    const p = player({ realIn28: 6, realIn7: 1 });
    expect(acwrReliable(p)).toBe(true);
    expect(acwrEstimated(p)).toBe(false);
  });

  it("défaut prudent : sans _load → estimé", () => {
    expect(acwrReliable({})).toBe(false);
  });

  it("expose les seuils retenus (6 et 1)", () => {
    expect(ACWR_MIN_LOGS_28).toBe(6);
    expect(ACWR_MIN_LOGS_7).toBe(1);
  });
});
