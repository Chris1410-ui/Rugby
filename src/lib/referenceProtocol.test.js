import { describe, it, expect } from "vitest";
import { REF_TEMPLATES, REF_JAMBES, REF_HAUT, REF_METHOD, REF_WORKOUTS, orderWeekdays } from "./referenceProtocol.js";
import { expandTemplates } from "../data/programs.js";

/* Le protocole de référence sert de MODÈLE : on vérifie le mapping jours (getDay)
   et que expandTemplates() le matérialise bien (jambes lun/mer/ven/dim, haut
   mar/jeu/sam) — sans rien coder en dur côté UI. */
describe("referenceProtocol", () => {
  it("mappe les jours au bon split (getDay 0=dim..6=sam)", () => {
    const byWeekday = Object.fromEntries(REF_TEMPLATES.map((t) => [t.weekday, t.titre]));
    // Jambes : lun(1), mer(3), ven(5)
    [1, 3, 5].forEach((d) => expect(byWeekday[d]).toBe("Jambes"));
    // Dimanche (0) = séance de records (PR le dimanche).
    expect(byWeekday[0]).toBe("Jambes · PR");
    // Haut du corps : mar(2), jeu(4), sam(6)
    [2, 4, 6].forEach((d) => expect(byWeekday[d]).toBe("Haut du corps"));
    // Les 7 jours sont couverts, une séance par jour.
    expect(REF_TEMPLATES).toHaveLength(7);
    expect(new Set(REF_TEMPLATES.map((t) => t.weekday)).size).toBe(7);
  });

  it("utilise une nature/valide et la méthode pyramidale", () => {
    REF_TEMPLATES.forEach((t) => expect(t.nature).toBe("force"));
    expect(REF_METHOD).toBe("12/10");
    expect(REF_JAMBES.length).toBeGreaterThan(0);
    expect(REF_HAUT.length).toBeGreaterThan(0);
    // Chaque exercice a un nom et des séries.
    [...REF_JAMBES, ...REF_HAUT].forEach((e) => {
      expect(e.name).toBeTruthy();
      expect(e.sets).toBeGreaterThan(0);
    });
    // Les charges cibles pré-remplissent la série 1 (charges littérales).
    expect(REF_HAUT.find((e) => e.name === "Développé couché").charge).toBe(100);
    expect(REF_JAMBES.find((e) => e.name === "Leg press").charge).toBe(250);
    expect(REF_JAMBES.find((e) => e.name === "Deadlift").charge).toBe(200);
    // Les accessoires en reps purs n'ont pas de charge cible.
    expect(REF_HAUT.find((e) => e.name.startsWith("Tractions")).charge).toBeUndefined();
  });

  it("REF_WORKOUTS reflète le même contenu que les templates (vue joueur)", () => {
    const jambes = REF_WORKOUTS.find((w) => w.key === "jambes");
    const haut = REF_WORKOUTS.find((w) => w.key === "haut");
    expect(jambes.exercises).toBe(REF_JAMBES);
    expect(haut.exercises).toBe(REF_HAUT);
    expect(jambes.days).toEqual([1, 3, 5, 0]);
    expect(haut.days).toEqual([2, 4, 6]);
  });

  it("orderWeekdays trie lundi → dimanche (0 en dernier)", () => {
    expect(orderWeekdays([1, 3, 5, 0])).toEqual([1, 3, 5, 0]);
    expect(orderWeekdays([0, 2, 6, 4])).toEqual([2, 4, 6, 0]);
  });

  it("se matérialise via expandTemplates sur une semaine", () => {
    // Semaine complète lun 2024-01-01 → dim 2024-01-07 : 7 séances (une/jour).
    const rows = expandTemplates({
      teamId: "T", start: "2024-01-01", end: "2024-01-07", templates: REF_TEMPLATES, assigned: { mode: "all" },
    });
    expect(rows).toHaveLength(7);
    // 2024-01-01 est un lundi → Jambes.
    const monday = rows.find((r) => r.date === "2024-01-01");
    expect(monday.titre).toBe("Jambes");
    // 2024-01-02 mardi → Haut du corps.
    const tuesday = rows.find((r) => r.date === "2024-01-02");
    expect(tuesday.titre).toBe("Haut du corps");
  });
});
