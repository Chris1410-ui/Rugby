import { describe, it, expect } from "vitest";
import { rangesOverlap, computeProtocolConflicts, removePlayerFromAssigned } from "./overlap.js";

const roster = [
  { id: "krakito", grp: "avants" },
  { id: "bob", grp: "arrieres" },
  { id: "zoe", grp: "avants" },
];

describe("rangesOverlap", () => {
  it("chevauchement / adjacence / disjoint", () => {
    expect(rangesOverlap("2026-07-01", "2026-07-31", "2026-07-15", "2026-08-15")).toBe(true);
    expect(rangesOverlap("2026-07-01", "2026-07-15", "2026-07-15", "2026-07-20")).toBe(true); // bornes incluses
    expect(rangesOverlap("2026-07-01", "2026-07-14", "2026-07-15", "2026-07-20")).toBe(false); // consécutifs
    expect(rangesOverlap("2026-07-01", "2026-07-31", null, "2026-07-10")).toBe(false); // borne manquante
  });
});

// existing = séances d'AUTRES protocoles (le candidat est déjà exclu par l'appelant).
const nuque = [
  { docId: "nuque", date: "2026-07-23", ids: ["krakito"] },
  { docId: "nuque", date: "2026-08-25", ids: ["krakito"] },
];

describe("computeProtocolConflicts — protocole vs protocole", () => {
  it("protocole chevauchant sur un joueur visé → conflit avec l'étendue réelle", () => {
    const c = computeProtocolConflicts({
      start: "2026-08-01", end: "2026-09-01", targetIds: ["krakito"],
      existing: nuque, docTitles: { nuque: "Renforcement nuque" },
    });
    expect(c).toEqual([{ playerId: "krakito", docId: "nuque", docTitle: "Renforcement nuque", from: "2026-07-23", to: "2026-08-25" }]);
  });

  it("protocoles CONSÉCUTIFS (pas de chevauchement) → aucun conflit", () => {
    const c = computeProtocolConflicts({
      start: "2026-08-26", end: "2026-09-20", targetIds: ["krakito"],
      existing: nuque, docTitles: { nuque: "Renforcement nuque" },
    });
    expect(c).toEqual([]);
  });

  it("joueur NON visé par le nouveau plan → aucun conflit", () => {
    const c = computeProtocolConflicts({
      start: "2026-08-01", end: "2026-09-01", targetIds: ["bob"],
      existing: nuque, docTitles: {},
    });
    expect(c).toEqual([]);
  });

  it("existing vide (le programme+protocole n'entre jamais ici) → aucun conflit", () => {
    // Les séances de PROGRAMME (program_id) ne sont pas passées dans `existing` :
    // seul protocole↔protocole est évalué → programme+protocole reste autorisé.
    expect(computeProtocolConflicts({ start: "2026-08-01", end: "2026-09-01", targetIds: ["krakito"], existing: [] })).toEqual([]);
  });
});

describe("removePlayerFromAssigned", () => {
  it("retire un joueur d'un 'all' → liste explicite sans lui", () => {
    expect(removePlayerFromAssigned({ mode: "all" }, "krakito", roster)).toEqual({ mode: "mix", groups: [], ids: ["bob", "zoe"] });
  });
  it("retire l'unique joueur → {mode:'none'}", () => {
    expect(removePlayerFromAssigned({ mode: "mix", groups: [], ids: ["krakito"] }, "krakito", roster)).toEqual({ mode: "none" });
  });
  it("retire un joueur couvert par sa ligne → reste la ligne dépliée sans lui", () => {
    // avants = krakito + zoe ; on retire krakito → il reste zoe.
    expect(removePlayerFromAssigned({ mode: "group", group: "avants" }, "krakito", roster)).toEqual({ mode: "mix", groups: [], ids: ["zoe"] });
  });
});
