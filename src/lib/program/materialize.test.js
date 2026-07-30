import { describe, it, expect } from "vitest";
import { docToSessions, codeForNature, withExerciseIds } from "./materialize.js";

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

  it("émet setPlan depuis une cellule à séries détaillées (+ rmLabel si %)", () => {
    const doc = {
      meta: { title: "P", weeks: 1, nature: "force" },
      sections: [{ type: "exercises", title: "Force", rows: [{
        name: "Bench", weeks: [{ text: "4 séries", sets: [
          { reps: "10", pct1rm: 80 }, { reps: "8", pct1rm: 85 }, { reps: "6", charge: 95 },
        ] }],
      }] }],
    };
    const exo = docToSessions(doc).sessions[0].exercises[0];
    expect(exo.name).toBe("Bench");
    expect(exo.setPlan).toEqual([
      { reps: "10", pct: 80 }, { reps: "8", pct: 85 }, { reps: "6", charge: 95 },
    ]);
    expect(exo.rmLabel).toBe("Bench"); // référence %1RM (pas de rmRef → le mouvement lui-même)
  });

  it("pas de setPlan si aucune cellule détaillée (rétro-compat)", () => {
    const doc = { meta: { title: "P", weeks: 1 }, sections: [{ type: "exercises", title: "S", rows: [{ name: "Squat", weeks: [{ text: "4×8" }] }] }] };
    expect(docToSessions(doc).sessions[0].exercises[0].setPlan).toBeUndefined();
  });

  it("matérialise une section conditioning en séance loggable (kind cardio_*)", () => {
    const doc = { meta: { title: "P", weeks: 1 }, sections: [
      { type: "conditioning", title: "VMA", blocks: [
        { id: "b1", kind: "cardio_interval", reps: "10", effort: { durationSec: 30 }, recovery: { durationSec: 30 }, pctVMA: "100" },
        { id: "b2", kind: "cardio_continuous", distanceM: "3000", pctVMA: "65" },
      ] },
    ] };
    const { sessions } = docToSessions(doc);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ nature: "conditioning", code: "CSB", titre: "VMA" });
    expect(sessions[0].exercises.map((e) => e.kind)).toEqual(["cardio_interval", "cardio_continuous"]);
  });

  it("conditioning coexiste avec une grille d'exercices (les deux séances)", () => {
    const doc = { meta: { title: "P", weeks: 1 }, sections: [
      { type: "exercises", title: "Force", rows: [{ name: "Squat", weeks: [{ text: "4×8" }] }] },
      { type: "conditioning", title: "Cardio", blocks: [{ id: "c1", kind: "cardio_continuous", distanceM: "2000" }] },
    ] };
    const natures = docToSessions(doc).sessions.map((s) => s.nature);
    expect(natures).toContain("conditioning");
    expect(docToSessions(doc).sessions.length).toBe(2);
  });

  it("émet la vidéo de la ligne (et rien si absente)", () => {
    const doc = { meta: { title: "P", weeks: 1 }, sections: [{ type: "exercises", title: "S", rows: [
      { name: "Squat", video: "https://youtu.be/abc", weeks: [{ text: "4×8" }] },
      { name: "Bench", weeks: [{ text: "5×5" }] },
    ] }] };
    const exos = docToSessions(doc).sessions[0].exercises;
    expect(exos[0].video).toBe("https://youtu.be/abc");
    expect(exos[1].video).toBeUndefined();
  });

  // Isolation de la saisie joueur : chaque exercice d'une séance DOIT avoir un id
  // unique (l'état de saisie est indexé par id → sans cela, fuite entre exercices).
  it("chaque exercice matérialisé porte un id unique", () => {
    const doc = { meta: { title: "P", weeks: 1 }, sections: [{ type: "exercises", title: "S", rows: [
      { name: "Squat", weeks: [{ text: "4×8" }] },
      { name: "Bench", weeks: [{ text: "5×5" }] },
      { name: "Tractions", weeks: [{ text: "30 reps" }] },
    ] }] };
    const exos = docToSessions(doc).sessions[0].exercises;
    const ids = exos.map((e) => e.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length); // tous distincts
  });
});

describe("withExerciseIds — id unique & stable par position", () => {
  it("attribue un id de repli aux exercices sans id, préserve les ids existants", () => {
    const out = withExerciseIds([{ name: "A" }, { name: "B", id: "keep" }, { name: "C" }]);
    expect(out.map((e) => e.id)).toEqual(["x0", "keep", "x2"]);
    expect(new Set(out.map((e) => e.id)).size).toBe(3);
  });
  it("déterministe : deux appels donnent les mêmes ids (rejouable au rechargement)", () => {
    const input = [{ name: "A" }, { name: "B" }];
    expect(withExerciseIds(input).map((e) => e.id)).toEqual(withExerciseIds(input).map((e) => e.id));
  });
});
