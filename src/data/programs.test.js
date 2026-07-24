import { describe, it, expect } from "vitest";
import { expandTemplates, planProgramUpdate } from "./programs.js";

/* #3 — envoi de programme. `expandTemplates` matérialise les séances datées.
   Le bouton « Envoyer » échouait silencieusement quand rien n'était généré
   (aucun exercice nommé, ou dates ne couvrant pas le jour choisi). Ces tests
   verrouillent le comportement ; l'UI donne désormais un message explicite. */

const tpl = (over) => ({
  weekday: 1, code: "RS", titre: "Force",
  exercises: [{ id: "e1", name: "Squat", sets: 3, reps: "8", charge: "", rest: 90 }],
  ...over,
});
const dow = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

describe("expandTemplates (matérialisation des séances)", () => {
  it("crée une séance par occurrence du jour dans la plage", () => {
    const start = "2026-07-13", end = "2026-07-27", weekday = 1;
    const out = expandTemplates({ teamId: "r_u18", start, end, templates: [tpl({ weekday })], assigned: { mode: "all" } });
    expect(out.length).toBeGreaterThan(0);
    out.forEach((s) => {
      expect(dow(s.date)).toBe(weekday);
      expect(s.date >= start && s.date <= end).toBe(true);
    });
    expect(out.map((s) => s.date)).toEqual([...out.map((s) => s.date)].sort()); // croissant
    expect(out[0]).toMatchObject({ team_id: "r_u18", code: "RS", titre: "Force" });
    expect(out[0].exercises[0].name).toBe("Squat");
    expect(out[0].program_id).toBeUndefined(); // ajouté après insertion du programme
  });

  it("ignore les séances sans exercice nommé (cause de l'échec silencieux)", () => {
    const out = expandTemplates({ teamId: "r_u18", start: "2026-07-13", end: "2026-07-27", templates: [tpl({ exercises: [{ id: "e1", name: "   " }] })], assigned: { mode: "all" } });
    expect(out).toEqual([]);
  });

  it("ne génère rien si la plage ne couvre pas le jour choisi", () => {
    const day = "2026-07-14";
    const out = expandTemplates({ teamId: "r_u18", start: day, end: day, templates: [tpl({ weekday: (dow(day) + 1) % 7 })], assigned: { mode: "all" } });
    expect(out).toEqual([]);
  });

  it("renvoie [] pour une plage inversée (fin avant début)", () => {
    const out = expandTemplates({ teamId: "r_u18", start: "2026-07-27", end: "2026-07-13", templates: [tpl()], assigned: { mode: "all" } });
    expect(out).toEqual([]);
  });

  // updateProgram ré-matérialise UNIQUEMENT les occurrences futures (≥ today) :
  // le filtre par date préserve le passé (séances déjà écoulées / loggées).
  it("le filtre futur ne conserve que les occurrences ≥ aujourd'hui", () => {
    const out = expandTemplates({ teamId: "r_u18", start: "2026-07-06", end: "2026-07-20", templates: [tpl({ weekday: 1 })], assigned: { mode: "all" } });
    expect(out.map((s) => s.date)).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
    const today = "2026-07-13";
    expect(out.filter((s) => s.date >= today).map((s) => s.date)).toEqual(["2026-07-13", "2026-07-20"]);
  });
});

/* Bug : un joueur ajouté aux destinataires à l'édition n'apparaissait pas sur une
   occurrence future DÉJÀ loggée (elle était préservée telle quelle, anciens
   destinataires gelés). planProgramUpdate doit RENVOYER cette séance dans
   keptLoggedIds (→ son `assigned` sera mis à jour) et NE PAS la ré-insérer. */
describe("planProgramUpdate (édition : historique préservé, destinataires propagés)", () => {
  const future = [
    { id: "s24", date: "2026-07-24" }, // déjà loggée
    { id: "s31", date: "2026-07-31" }, // non loggée
  ];
  const expanded = [
    { date: "2026-07-24", assigned: { mode: "mix" } },
    { date: "2026-07-31", assigned: { mode: "mix" } },
    { date: "2026-08-07", assigned: { mode: "mix" } },
  ];

  it("séance loggée conservée (destinataires à mettre à jour), non-loggée supprimée + ré-insérée", () => {
    const plan = planProgramUpdate({ future, loggedIds: new Set(["s24"]), today: "2026-07-24", expanded });
    expect(plan.keptLoggedIds).toEqual(["s24"]);                                   // 24/07 préservée → assigned propagé
    expect(plan.toDelete).toEqual(["s31"]);                                        // 31/07 non loggée → supprimée
    expect(plan.toInsert.map((r) => r.date)).toEqual(["2026-07-31", "2026-08-07"]); // 24/07 exclue (kept) → pas de doublon
  });

  it("aucune séance loggée → tout est supprimé/ré-inséré (comportement inchangé)", () => {
    const plan = planProgramUpdate({ future, loggedIds: new Set(), today: "2026-07-24", expanded });
    expect(plan.keptLoggedIds).toEqual([]);
    expect(plan.toDelete).toEqual(["s24", "s31"]);
    expect(plan.toInsert.map((r) => r.date)).toEqual(["2026-07-24", "2026-07-31", "2026-08-07"]);
  });

  it("accepte loggedIds sous forme de tableau (pas seulement Set)", () => {
    const plan = planProgramUpdate({ future, loggedIds: ["s24"], today: "2026-07-24", expanded });
    expect(plan.keptLoggedIds).toEqual(["s24"]);
  });
});
