import { describe, it, expect } from "vitest";
import { deriveSlots, planDocToSessions } from "./planMaterialize.js";

const dow = (iso) => new Date(`${iso}T00:00:00`).getDay();

// Protocole avec UNE grille d'exercices, progression S1→S3 explicite.
const squatRows = [{ name: "Back Squat", tempo: "2010", weeks: [{ text: "4×8 R7" }, { text: "5×5 R8" }, { text: "3×5 R7" }] }];
const docGrid = {
  meta: { weeks: 3, nature: "force" },
  sections: [{ type: "exercises", title: "Bloc force", rows: squatRows }],
};

describe("deriveSlots — créneaux d'une semaine-type", () => {
  it("grille d'exercices seule → un créneau portant ses lignes", () => {
    const { slots } = deriveSlots(docGrid);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ label: "Bloc force", nature: "force", code: "RS" });
    expect(slots[0].rows[0].name).toBe("Back Squat");
  });

  it("semaine type (weekcalendar) : un créneau par jour actif, grille unique rattachée au jour force", () => {
    const doc = {
      meta: { weeks: 3 },
      sections: [
        { type: "weekcalendar", title: "Semaine", days: [
          { day: "lundi", label: "Muscu", nature: "force" },
          { day: "mercredi", label: "Cardio", nature: "conditioning" },
          { day: "dimanche", label: "OFF", off: true },
        ] },
        { type: "exercises", title: "Bloc", rows: squatRows },
      ],
    };
    const { slots } = deriveSlots(doc);
    expect(slots).toHaveLength(2); // OFF écarté
    const muscu = slots.find((s) => s.label === "Muscu");
    const cardio = slots.find((s) => s.label === "Cardio");
    expect(muscu.weekday).toBe(1);
    expect(muscu.rows.length).toBe(1);   // grille rattachée au jour force
    expect(cardio.rows.length).toBe(0);  // pas de grille → libellé seul
  });

  it("aucun contenu datable → slots vides + avertissement", () => {
    const { slots, warnings } = deriveSlots({ meta: { weeks: 4 }, sections: [{ type: "narrative", title: "Intro", body: "x" }] });
    expect(slots).toEqual([]);
    expect(warnings).toContain("no-slots");
  });
});

describe("planDocToSessions — déroulé S1→Sn sur les vraies semaines", () => {
  const slot = { weekday: 3, label: "Bloc force", nature: "force", code: "RS", rows: squatRows };

  it("une séance par semaine, sur le weekday choisi, progression Sk mappée", () => {
    const { rows, warnings } = planDocToSessions(docGrid, { startDate: "2026-08-03", weeks: 3, slots: [slot] });
    expect(rows).toHaveLength(3);
    rows.forEach((r) => expect(dow(r.date)).toBe(3)); // toutes un mercredi
    // espacement hebdomadaire
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
    // PROGRESSION : S1=4×8, S2=5×5, S3=3×5
    expect(rows.map((r) => `${r.exercises[0].sets}x${r.exercises[0].reps}`)).toEqual(["4x8", "5x5", "3x5"]);
    expect(rows.map((r) => r.source_week)).toEqual([1, 2, 3]);
    expect(rows[0].source_label).toBe("Bloc force");
    expect(warnings).not.toContain("clamp");
  });

  it("N réel > semaines du protocole → clamp sur le dernier bloc + avertissement", () => {
    const { rows, warnings } = planDocToSessions(docGrid, { startDate: "2026-08-03", weeks: 5, slots: [slot] });
    expect(rows).toHaveLength(5);
    // semaines 4 et 5 répètent la dernière colonne (3×5)
    expect(rows.map((r) => `${r.exercises[0].sets}x${r.exercises[0].reps}`)).toEqual(["4x8", "5x5", "3x5", "3x5", "3x5"]);
    expect(rows.map((r) => r.source_week)).toEqual([1, 2, 3, 4, 5]);
    expect(warnings).toContain("clamp");
  });

  it("créneau libellé seul (sans grille) → séance à une ligne constante chaque semaine", () => {
    const labelSlot = { weekday: 5, label: "Cardio", nature: "conditioning", code: "CSB", rows: [] };
    const { rows } = planDocToSessions(docGrid, { startDate: "2026-08-03", weeks: 2, slots: [labelSlot] });
    expect(rows).toHaveLength(2);
    rows.forEach((r) => { expect(r.exercises).toHaveLength(1); expect(r.exercises[0].name).toBe("Cardio"); });
  });

  it("plusieurs créneaux → séances triées par date", () => {
    const s2 = { weekday: 1, label: "Lundi", nature: "force", code: "RS", rows: squatRows };
    const s3 = { weekday: 5, label: "Vendredi", nature: "conditioning", code: "CSB", rows: [] };
    const { rows } = planDocToSessions(docGrid, { startDate: "2026-08-03", weeks: 2, slots: [s3, s2] });
    expect(rows).toHaveLength(4);
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort()); // ordre chronologique garanti
  });

  it("date de début invalide → aucune séance", () => {
    expect(planDocToSessions(docGrid, { startDate: "", weeks: 3, slots: [slot] }).rows).toEqual([]);
  });

  it("slots par défaut dérivés du protocole si non fournis", () => {
    const { rows } = planDocToSessions(docGrid, { startDate: "2026-08-03", weeks: 3 });
    expect(rows).toHaveLength(3); // 1 créneau (grille) × 3 semaines
    expect(rows[0].exercises[0].name).toBe("Back Squat");
  });
});
