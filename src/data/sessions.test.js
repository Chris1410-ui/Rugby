import { describe, it, expect } from "vitest";
import { resolveAssignedIds, dbToSession, buildAssigned, assignedToSelection } from "./sessions.js";

const roster = [
  { id: "a", grp: "avants" },
  { id: "b", grp: "arrieres" },
  { id: "c", grp: "avants" },
];

describe("resolveAssignedIds — destinataires d'une séance", () => {
  it("mode 'all' → tout l'effectif", () => {
    expect(resolveAssignedIds({ mode: "all" }, roster)).toEqual(["a", "b", "c"]);
  });
  it("assigned absent → tout l'effectif", () => {
    expect(resolveAssignedIds(null, roster)).toEqual(["a", "b", "c"]);
  });
  it("mode 'group' → uniquement la ligne", () => {
    expect(resolveAssignedIds({ mode: "group", group: "avants" }, roster)).toEqual(["a", "c"]);
  });
  it("mode 'players' → la liste fournie", () => {
    expect(resolveAssignedIds({ mode: "players", ids: ["b"] }, roster)).toEqual(["b"]);
  });
  it("mode 'mix' → union ligne(s) + joueurs, dédupliquée", () => {
    // Avants (a, c) + le joueur b (arrières) ajouté individuellement.
    expect(resolveAssignedIds({ mode: "mix", groups: ["avants"], ids: ["b"] }, roster)).toEqual(["a", "b", "c"]);
  });
  it("mode 'mix' → dédup si un joueur ajouté est déjà couvert par sa ligne", () => {
    // Avants (a, c) + a ajouté en plus → pas de doublon.
    expect(resolveAssignedIds({ mode: "mix", groups: ["avants"], ids: ["a"] }, roster)).toEqual(["a", "c"]);
  });
  it("mode 'mix' → uniquement des joueurs (groups vide)", () => {
    expect(resolveAssignedIds({ mode: "mix", groups: [], ids: ["b", "c"] }, roster)).toEqual(["b", "c"]);
  });
});

describe("buildAssigned — sélection additive → jsonb assigned", () => {
  it("« Toute l'équipe » → {mode:'all'}", () => {
    expect(buildAssigned({ all: true, groups: ["avants"], ids: ["b"] })).toEqual({ mode: "all" });
  });
  it("rien de sélectionné → {mode:'all'} (repli prudent)", () => {
    expect(buildAssigned({ groups: [], ids: [] })).toEqual({ mode: "all" });
  });
  it("lignes + joueurs → {mode:'mix'} nettoyé/dédup", () => {
    expect(buildAssigned({ groups: ["avants", "avants"], ids: ["b", "b", ""] })).toEqual({ mode: "mix", groups: ["avants"], ids: ["b"] });
  });
});

describe("assignedToSelection — pré-remplissage à l'édition", () => {
  it("all / group / players / mix → forme du sélecteur", () => {
    expect(assignedToSelection({ mode: "all" })).toEqual({ all: true, groups: [], ids: [] });
    expect(assignedToSelection({ mode: "group", group: "arrieres" })).toEqual({ all: false, groups: ["arrieres"], ids: [] });
    expect(assignedToSelection({ mode: "players", ids: ["b"] })).toEqual({ all: false, groups: [], ids: ["b"] });
    expect(assignedToSelection({ mode: "mix", groups: ["avants"], ids: ["b"] })).toEqual({ all: false, groups: ["avants"], ids: ["b"] });
  });
});

describe("dbToSession — mapping ligne DB → forme applicative", () => {
  it("mappe program_id, exercises et résout assignedIds", () => {
    const row = {
      id: "s1",
      program_id: "p1",
      date: "2026-07-01",
      code: "RS",
      titre: "Force",
      duration_min: 75,
      exercises: [{ id: "e1", name: "Back Squat" }],
      assigned: { mode: "group", group: "avants" },
    };
    const s = dbToSession(row, roster);
    expect(s.programId).toBe("p1");
    expect(s.dur).toBe(75);
    expect(s.exercises).toHaveLength(1);
    expect(s.assignedIds).toEqual(["a", "c"]);
  });
});
