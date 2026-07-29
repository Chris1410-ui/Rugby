import { describe, it, expect } from "vitest";
import { NATURES } from "./nature.js";
import { SESSION_CODES } from "./tokens.js";
import {
  SESSION_TYPES, DEFAULT_SESSION_TYPE, BLOCK_KINDS,
  normalizeSessionType, effectiveSessionType, blockKind,
  kindIsCardio, kindUsesLoad, kindIsSetLike,
  natureForType, codeForType, allowedKindsForType, libraryFilterForType,
  TYPE_DEFAULT_NATURE, TYPE_DEFAULT_CODE,
  exerciseInputModel, inputModelIsEffort, inputModelUsesLoad, NATURE_INPUT_MODEL,
} from "./sessionType.js";

describe("sessionType — vocabulaire", () => {
  it("expose les 5 types attendus", () => {
    expect(SESSION_TYPES).toEqual(["strength", "conditioning", "bodyweight", "skills", "mixed"]);
    expect(DEFAULT_SESSION_TYPE).toBe("strength");
  });

  it("normalizeSessionType replie toute valeur inconnue sur 'strength'", () => {
    expect(normalizeSessionType("conditioning")).toBe("conditioning");
    expect(normalizeSessionType("bogus")).toBe("strength");
    expect(normalizeSessionType(null)).toBe("strength");
    expect(normalizeSessionType(undefined)).toBe("strength");
  });

  it("effectiveSessionType lit les anciennes séances comme 'strength'", () => {
    expect(effectiveSessionType(undefined)).toBe("strength");
    expect(effectiveSessionType("skills")).toBe("skills");
  });
});

describe("sessionType — kinds de bloc", () => {
  it("blockKind défaut 'strength' pour item legacy ou kind inconnu", () => {
    expect(blockKind({})).toBe("strength");
    expect(blockKind({ kind: "cardio_interval" })).toBe("cardio_interval");
    expect(blockKind({ kind: "bogus" })).toBe("strength");
    expect(blockKind(null)).toBe("strength");
  });

  it("kindIsCardio : seuls les blocs cardio_*", () => {
    expect(kindIsCardio("cardio_continuous")).toBe(true);
    expect(kindIsCardio("cardio_interval")).toBe(true);
    expect(kindIsCardio("cardio_circuit")).toBe(true);
    expect(kindIsCardio("cardio_test")).toBe(true);
    expect(kindIsCardio("strength")).toBe(false);
    expect(kindIsCardio("bodyweight")).toBe(false);
  });

  it("kindUsesLoad : charge kg seulement pour strength (lest bodyweight = option)", () => {
    expect(kindUsesLoad("strength")).toBe(true);
    expect(kindUsesLoad("bodyweight")).toBe(false);
    expect(kindUsesLoad("skill")).toBe(false);
    expect(kindUsesLoad("cardio_continuous")).toBe(false);
  });

  it("kindIsSetLike : grille de séries/répétitions cochables", () => {
    expect(kindIsSetLike("strength")).toBe(true);
    expect(kindIsSetLike("bodyweight")).toBe(true);
    expect(kindIsSetLike("skill")).toBe(true);
    expect(kindIsSetLike("cardio_interval")).toBe(true); // reps cochables
    expect(kindIsSetLike("cardio_continuous")).toBe(false);
    expect(kindIsSetLike("cardio_circuit")).toBe(false);
  });
});

describe("sessionType — défauts nature/code cohérents avec le reste de l'app", () => {
  it("chaque nature par défaut est une nature valide (nature.js)", () => {
    for (const type of SESSION_TYPES) expect(NATURES).toContain(TYPE_DEFAULT_NATURE[type]);
  });

  it("chaque code par défaut est un code de séance valide (tokens.js)", () => {
    for (const type of SESSION_TYPES) expect(SESSION_CODES).toContain(TYPE_DEFAULT_CODE[type]);
  });

  it("mappings dédiés", () => {
    expect(natureForType("conditioning")).toBe("conditioning");
    expect(natureForType("bodyweight")).toBe("force");
    expect(codeForType("skills")).toBe("AC");
    expect(codeForType("bogus")).toBe("RS"); // repli via normalize
  });
});

describe("sessionType — kinds autorisés & filtre biblio par type", () => {
  it("strength n'autorise que le bloc strength ; mixed autorise tout", () => {
    expect(allowedKindsForType("strength")).toEqual(["strength"]);
    expect(allowedKindsForType("mixed")).toEqual(BLOCK_KINDS);
    expect(allowedKindsForType("conditioning")).not.toContain("strength");
  });

  it("filtre biblio : null pour strength/mixed, ciblé sinon", () => {
    expect(libraryFilterForType("strength")).toBeNull();
    expect(libraryFilterForType("mixed")).toBeNull();
    expect(libraryFilterForType("conditioning")).toEqual({ bodyPart: "cardio" });
    expect(libraryFilterForType("bodyweight")).toMatchObject({ equipment: "body weight", noEquipment: true });
    expect(libraryFilterForType("skills").calisthenics).toBe(true);
  });
});

describe("sessionType — modèle de saisie d'un exercice (par nature)", () => {
  it("un bloc STRUCTURÉ (kind explicite) fait toujours foi, quelle que soit la nature", () => {
    expect(exerciseInputModel({ kind: "cardio_interval" }, "force")).toBe("cardio_interval");
    expect(exerciseInputModel({ kind: "skill" }, "conditioning")).toBe("skill");
    expect(exerciseInputModel({ kind: "strength" }, "conditioning")).toBe("strength");
  });
  it("un exercice PLAT (sans kind) dérive de la NATURE de la séance", () => {
    expect(exerciseInputModel({ name: "Squat" }, "force")).toBe("strength");
    expect(exerciseInputModel({ name: "Renfo" }, "prevention")).toBe("strength");
    expect(exerciseInputModel({ name: "Course" }, "conditioning")).toBe("conditioning");
    expect(exerciseInputModel({ name: "Sprints" }, "vitesse")).toBe("vitesse");
    expect(exerciseInputModel({ name: "Étirements" }, "mobilite")).toBe("mobility");
    expect(exerciseInputModel({ name: "Retour au calme" }, "recuperation")).toBe("mobility");
    expect(exerciseInputModel({ name: "Passes" }, "technique")).toBe("skill");
  });
  it("nature absente / inconnue → 'strength' (repli sûr, comportement legacy)", () => {
    expect(exerciseInputModel({ name: "X" }, "")).toBe("strength");
    expect(exerciseInputModel({ name: "X" }, "autre")).toBe("strength");
    expect(exerciseInputModel({ name: "X" }, undefined)).toBe("strength");
  });
  it("classe effort (mono) vs charge (kg)", () => {
    expect(inputModelIsEffort("conditioning")).toBe(true);
    expect(inputModelIsEffort("vitesse")).toBe(true);
    expect(inputModelIsEffort("mobility")).toBe(true);
    expect(inputModelIsEffort("strength")).toBe(false);
    expect(inputModelUsesLoad("strength")).toBe(true);
    expect(inputModelUsesLoad("bodyweight")).toBe(true);
    expect(inputModelUsesLoad("conditioning")).toBe(false);
    expect(inputModelUsesLoad("skill")).toBe(false);
  });
  it("chaque nature du vocabulaire a un modèle de saisie", () => {
    for (const n of NATURES) expect(typeof NATURE_INPUT_MODEL[n]).toBe("string");
  });
});
