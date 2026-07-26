import { describe, it, expect } from "vitest";
import { teamRecommendations, RECO } from "./coaching.js";
import { RELIABILITY } from "./dataQuality.js";

const today = "2024-03-31";
// Séance prescrite assignée à un joueur, datée, faite ou non (pour la fiabilité de charge).
const S = (id, date, pid) => ({ id, date, origin: "staff", assignedIds: [pid] });
// Génère N séances loggées « done » pour rendre la charge fiable (loadReliability).
function reliableLoad(pid, n = RELIABILITY.loadMinSessions) {
  const sessions = [], logs = {};
  for (let i = 0; i < n; i++) {
    const id = `${pid}-l${i}`;
    sessions.push(S(id, `2024-03-${String(10 + i).padStart(2, "0")}`, pid));
    (logs[id] = {})[pid] = { status: "done" };
  }
  return { sessions, logs };
}
const kinds = (res, pid) => res.recos.filter((r) => r.playerId === pid).map((r) => r.kind);

describe("teamRecommendations", () => {
  it("overload (charge fiable) : zone over → reco haute ; réactive uniquement si fiable", () => {
    const p = { id: "a", name: "A", _load: { zone: { key: "over" }, acwr: 1.62, monotony: 1.2 }, _live: false };
    const { sessions, logs } = reliableLoad("a");
    // bilan récent pour ne pas déclencher reengage
    const bilans = { a: [{ date: today, moment: "matin" }] };
    const res = teamRecommendations({ players: [p], sessions, logs, bilans, today });
    expect(kinds(res, "a")).toContain("overload");
  });

  it("gate de fiabilité : zone over mais trop peu de séances → pas de reco de charge", () => {
    const p = { id: "a", name: "A", _load: { zone: { key: "over" }, acwr: 1.62, monotony: 3 }, _live: false };
    const { sessions, logs } = reliableLoad("a", 2); // < loadMinSessions
    const bilans = { a: [{ date: today, moment: "matin" }] };
    const res = teamRecommendations({ players: [p], sessions, logs, bilans, today });
    expect(kinds(res, "a")).not.toContain("overload");
    expect(kinds(res, "a")).not.toContain("monotony");
  });

  it("prévention (risque élevé) et lowReadiness (bilan du jour bas)", () => {
    const p = { id: "a", name: "A", _load: { zone: { key: "target" }, acwr: 1.1, monotony: 1 }, risque: 72, readiness: 33, _live: true };
    const bilans = { a: [{ date: today, moment: "matin" }] };
    const res = teamRecommendations({ players: [p], sessions: [], logs: {}, bilans, today });
    expect(kinds(res, "a")).toEqual(expect.arrayContaining(["prevention", "lowReadiness"]));
  });

  it("adhérence : joueur sous le seuil → reco engagement haute", () => {
    const pid = "a";
    const sessions = [], logs = {};
    for (let i = 0; i < RELIABILITY.loadMinSessions; i++) { // 6 séances prescrites échues
      const id = `${pid}-p${i}`;
      sessions.push({ id, date: `2024-03-${String(10 + i).padStart(2, "0")}`, origin: "staff", assignedIds: [pid] });
      (logs[id] = {})[pid] = { status: i < 2 ? "done" : "missed" }; // 2/6 → 33 % < 70 %
    }
    const p = { id: pid, name: "A", _load: { zone: { key: "target" }, acwr: 1, monotony: 1 }, _live: true, readiness: 80 };
    const bilans = { a: [{ date: today, moment: "matin" }] };
    const res = teamRecommendations({ players: [p], sessions, logs, bilans, today });
    expect(kinds(res, "a")).toContain("adherence");
  });

  it("reengage : aucun bilan récent (7 j) → reco de reprise de contact", () => {
    const p = { id: "a", name: "A", _load: { zone: { key: "target" }, acwr: 1, monotony: 1 }, _live: false };
    const res = teamRecommendations({ players: [p], sessions: [], logs: {}, bilans: {}, today });
    expect(kinds(res, "a")).toContain("reengage");
  });

  it("priorise les recos hautes en tête et compte par sévérité", () => {
    const over = { id: "a", name: "Zed", _load: { zone: { key: "over" }, acwr: 1.7, monotony: 1 }, _live: false };
    const rd = reliableLoad("a");
    const calm = { id: "b", name: "Abe", _load: { zone: { key: "target" }, acwr: 1, monotony: 1 }, risque: 65, _live: false };
    const bilans = { a: [{ date: today, moment: "matin" }], b: [{ date: today, moment: "matin" }] };
    const res = teamRecommendations({ players: [over, calm], sessions: rd.sessions, logs: rd.logs, bilans, today });
    expect(res.recos[0].sev).toBe("high");   // overload (a) avant prevention (b, med)
    expect(res.recos[0].playerId).toBe("a");
    expect(res.counts.high).toBeGreaterThanOrEqual(1);
    expect(res.nPlayers).toBe(2);
  });
});
