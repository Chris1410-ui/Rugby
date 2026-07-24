import { describe, it, expect } from "vitest";
import { docToSessions, codeForNature } from "./materialize.js";

describe("codeForNature", () => {
  it("mappe la nature vers un code rugby, repli RS", () => {
    expect(codeForNature("force")).toBe("RS");
    expect(codeForNature("vitesse")).toBe("COD");
    expect(codeForNature("conditioning")).toBe("CSB");
    expect(codeForNature("inconnu")).toBe("RS");
  });
});

describe("docToSessions — semaine type (weekcalendar)", () => {
  const doc = {
    meta: { title: "P", weeks: 4, nature: "force" },
    sections: [
      { type: "weekcalendar", title: "Semaine type", days: [
        { weekday: 1, label: "Musculation haut", nature: "force" },
        { weekday: 3, label: "Cardio Z2", nature: "conditioning" },
        { weekday: 0, label: "Repos", off: true },
      ] },
      { type: "exercises", title: "Séance force", rows: [
        { name: "Squat", weeks: [{ text: "4×8 R7" }, { text: "4×6" }] },
        { name: "Développé", weeks: [{ text: "3x10" }] },
      ] },
    ],
  };

  it("crée une séance par jour actif (ignore les jours off)", () => {
    const { sessions } = docToSessions(doc);
    expect(sessions.map((s) => s.weekday)).toEqual([1, 3]);
    expect(sessions.map((s) => s.code)).toEqual(["RS", "CSB"]);
    expect(sessions[0].titre).toBe("Musculation haut");
  });

  it("rattache la grille unique aux jours de force et parse sets×reps", () => {
    const { sessions } = docToSessions(doc);
    const force = sessions.find((s) => s.nature === "force");
    expect(force.exercises.map((e) => e.name)).toEqual(["Squat", "Développé"]);
    expect(force.exercises[0]).toMatchObject({ sets: "4", reps: "8" });
    // Le jour cardio n'a pas de grille dédiée → une ligne = l'intitulé du jour.
    const cardio = sessions.find((s) => s.nature === "conditioning");
    expect(cardio.exercises).toHaveLength(1);
    expect(cardio.exercises[0].name).toBe("Cardio Z2");
  });

  it("ne devine pas la répartition si plusieurs grilles existent (avertit)", () => {
    const multi = { ...doc, sections: [
      doc.sections[0],
      { type: "exercises", title: "A", rows: [{ name: "Squat", weeks: [{ text: "4×8" }] }] },
      { type: "exercises", title: "B", rows: [{ name: "Bench", weeks: [{ text: "5×5" }] }] },
    ] };
    const { sessions, warnings } = docToSessions(multi);
    // Jour force → une ligne = l'intitulé (pas de rattachement ambigu).
    expect(sessions[0].exercises[0].name).toBe("Musculation haut");
    expect(warnings.join(" ")).toMatch(/grilles/i);
  });
});

describe("docToSessions — sans semaine type", () => {
  it("dérive une séance par grille d'exercices, jours lun..sam", () => {
    const doc = {
      meta: { title: "P", weeks: 2, nature: "force" },
      sections: [
        { type: "exercises", title: "Jour 1", rows: [{ name: "Squat", weeks: [{ text: "4×8" }] }] },
        { type: "exercises", title: "Jour 2", rows: [{ name: "Bench", weeks: [{ text: "5×5" }] }] },
      ],
    };
    const { sessions } = docToSessions(doc);
    expect(sessions.map((s) => s.weekday)).toEqual([1, 2]);
    expect(sessions.map((s) => s.titre)).toEqual(["Jour 1", "Jour 2"]);
    expect(sessions[0].exercises[0]).toMatchObject({ name: "Squat", sets: "4", reps: "8" });
  });

  it("aucun contenu datable → séances vides + avertissement", () => {
    const { sessions, warnings } = docToSessions({ meta: { title: "P" }, sections: [{ type: "narrative", title: "Intro", body: "..." }] });
    expect(sessions).toEqual([]);
    expect(warnings.join(" ")).toMatch(/Aucune séance/i);
  });
});
