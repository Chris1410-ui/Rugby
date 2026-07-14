import { describe, it, expect } from "vitest";
import { expandTemplates } from "./programs.js";

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
});
