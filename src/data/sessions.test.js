import { describe, it, expect } from "vitest";
import { resolveAssignedIds, dbToSession, buildAssigned, assignedToSelection, assignedCoversPlayer, assignedIsEmpty } from "./sessions.js";

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
  it("« Toute l'équipe » explicite → {mode:'all'}", () => {
    expect(buildAssigned({ all: true, groups: ["avants"], ids: ["b"] })).toEqual({ mode: "all" });
  });
  it("RIEN de sélectionné → {mode:'none'} (JAMAIS 'all' — c'est le bug corrigé)", () => {
    // Régression : un protocole destiné à personne ne doit pas partir à toute l'équipe.
    expect(buildAssigned({ groups: [], ids: [] })).toEqual({ mode: "none" });
    expect(buildAssigned({})).toEqual({ mode: "none" });
    expect(buildAssigned()).toEqual({ mode: "none" });
  });
  it("UN seul joueur → {mode:'mix'} avec ce seul id (ne s'élargit pas à l'équipe)", () => {
    expect(buildAssigned({ ids: ["b"] })).toEqual({ mode: "mix", groups: [], ids: ["b"] });
    expect(resolveAssignedIds(buildAssigned({ ids: ["b"] }), roster)).toEqual(["b"]);
  });
  it("PLUSIEURS joueurs → {mode:'mix'} avec leurs ids", () => {
    expect(resolveAssignedIds(buildAssigned({ ids: ["a", "b"] }), roster)).toEqual(["a", "b"]);
  });
  it("UNE ligne seule → {mode:'mix'} avec ce groupe", () => {
    expect(buildAssigned({ groups: ["avants"] })).toEqual({ mode: "mix", groups: ["avants"], ids: [] });
    expect(resolveAssignedIds(buildAssigned({ groups: ["avants"] }), roster)).toEqual(["a", "c"]);
  });
  it("ligne + joueurs → {mode:'mix'} nettoyé/dédup", () => {
    expect(buildAssigned({ groups: ["avants", "avants"], ids: ["b", "b", ""] })).toEqual({ mode: "mix", groups: ["avants"], ids: ["b"] });
  });
});

describe("assignedIsEmpty — refus de publication quand aucun destinataire", () => {
  it("none / mix vide / players vide → vide (refus)", () => {
    expect(assignedIsEmpty(buildAssigned({ groups: [], ids: [] }))).toBe(true);
    expect(assignedIsEmpty({ mode: "none" })).toBe(true);
    expect(assignedIsEmpty({ mode: "mix", groups: [], ids: [] })).toBe(true);
    expect(assignedIsEmpty({ mode: "players", ids: [] })).toBe(true);
  });
  it("all / group / un joueur / une ligne → non vide (publication autorisée)", () => {
    expect(assignedIsEmpty({ mode: "all" })).toBe(false);
    expect(assignedIsEmpty(null)).toBe(false); // absent ⇒ défaut 'all'
    expect(assignedIsEmpty({ mode: "group", group: "avants" })).toBe(false);
    expect(assignedIsEmpty(buildAssigned({ ids: ["b"] }))).toBe(false);
    expect(assignedIsEmpty(buildAssigned({ groups: ["avants"] }))).toBe(false);
    expect(assignedIsEmpty(buildAssigned({ groups: ["avants"], ids: ["b"] }))).toBe(false);
  });
});

describe("resolveAssignedIds / assignedCoversPlayer — mode 'none'", () => {
  it("none → personne", () => {
    expect(resolveAssignedIds({ mode: "none" }, roster)).toEqual([]);
    expect(assignedCoversPlayer({ mode: "none" }, { id: "a", grp: "avants" })).toBe(false);
  });
});

describe("assignedToSelection — pré-remplissage à l'édition", () => {
  it("all / group / players / mix → forme du sélecteur", () => {
    expect(assignedToSelection({ mode: "all" })).toEqual({ all: true, groups: [], ids: [] });
    expect(assignedToSelection({ mode: "group", group: "arrieres" })).toEqual({ all: false, groups: ["arrieres"], ids: [] });
    expect(assignedToSelection({ mode: "players", ids: ["b"] })).toEqual({ all: false, groups: [], ids: ["b"] });
    expect(assignedToSelection({ mode: "mix", groups: ["avants"], ids: ["b"] })).toEqual({ all: false, groups: ["avants"], ids: ["b"] });
    expect(assignedToSelection({ mode: "none" })).toEqual({ all: false, groups: [], ids: [] });
  });
});

describe("assignedCoversPlayer — appartenance d'UN joueur (sans effectif)", () => {
  const avant = { id: "a", grp: "avants" };
  const arriere = { id: "b", grp: "arrieres" };
  it("all → tout le monde", () => {
    expect(assignedCoversPlayer({ mode: "all" }, avant)).toBe(true);
    expect(assignedCoversPlayer(null, arriere)).toBe(true);
  });
  it("group → seulement la ligne", () => {
    expect(assignedCoversPlayer({ mode: "group", group: "avants" }, avant)).toBe(true);
    expect(assignedCoversPlayer({ mode: "group", group: "avants" }, arriere)).toBe(false);
  });
  it("players → seulement les ids", () => {
    expect(assignedCoversPlayer({ mode: "players", ids: ["b"] }, arriere)).toBe(true);
    expect(assignedCoversPlayer({ mode: "players", ids: ["b"] }, avant)).toBe(false);
  });
  it("mix → union ligne(s) + ids (l'arrière ajouté nominativement est couvert)", () => {
    const a = { mode: "mix", groups: ["avants"], ids: ["b"] };
    expect(assignedCoversPlayer(a, avant)).toBe(true);   // via sa ligne
    expect(assignedCoversPlayer(a, arriere)).toBe(true); // ajouté nommément
    expect(assignedCoversPlayer(a, { id: "c", grp: "arrieres" })).toBe(false);
  });
  it("open → non ciblé nominativement", () => {
    expect(assignedCoversPlayer({ mode: "open" }, avant)).toBe(false);
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
