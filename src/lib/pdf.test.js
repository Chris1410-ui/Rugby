import { describe, it, expect } from "vitest";
import { parseLinesToProgram, detectNature } from "./pdf.js";

describe("PDF → programme (parseur pur)", () => {
  it("detectNature : mots-clés → nature contrôlée", () => {
    expect(detectNature("Séance force / squat")).toBe("force");
    expect(detectNature("Bloc cardio intermittent 30-15")).toBe("conditioning");
    expect(detectNature("Prévention ischio nordic")).toBe("prevention");
    expect(detectNature("Mobilité hanche")).toBe("mobilite");
    expect(detectNature("Récupération étirements")).toBe("recuperation");
    expect(detectNature("truc sans indice")).toBe("");
  });

  it("découpe en séances par jour + parse les exercices (séries/reps/charge)", () => {
    const lines = [
      "Programme intersaison",           // bruit-ish → unread (pas exo, pas header)
      "Lundi — Force",
      "Squat 4x8 80%",
      "Développé couché 3 x 10",
      "Mardi — Cardio",
      "Sprint 6x30m",
      "10",                              // bruit (numéro) → ignoré
    ];
    const { sessions } = parseLinesToProgram(lines);
    expect(sessions.length).toBe(2);

    const [lun, mar] = sessions;
    expect(lun.weekday).toBe(1);
    expect(lun.nature).toBe("force");
    expect(lun.exercises.length).toBe(2);
    expect(lun.exercises[0]).toMatchObject({ name: "Squat", sets: 4, reps: "8", charge: "80%" });
    expect(lun.exercises[1]).toMatchObject({ name: "Développé couché", sets: 3, reps: "10" });

    expect(mar.weekday).toBe(2);
    expect(mar.nature).toBe("conditioning");
    expect(mar.exercises[0]).toMatchObject({ name: "Sprint", sets: 6 });
  });

  it("signale jour/nature manquants + lignes non comprises, sans rien écrire", () => {
    const lines = [
      "Séance 1",             // header sans jour ni nature
      "Pompes 4x10",          // exo sans indice de nature
      "Blabla consigne libre importante",  // non compris (pas exo)
    ];
    const { sessions, warnings, unread } = parseLinesToProgram(lines);
    expect(sessions.length).toBe(1);
    // jour comblé par défaut pour rester éditable
    expect(typeof sessions[0].weekday).toBe("number");
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("noDay");
    expect(codes).toContain("noNature");
    expect(codes).toContain("unread");
    expect(unread).toContain("Blabla consigne libre importante");
  });

  it("aucune séance exploitable → warning empty", () => {
    const { sessions, warnings } = parseLinesToProgram(["page 1", "12/07/2026", "..."]);
    expect(sessions).toEqual([]);
    expect(warnings.some((w) => w.code === "empty")).toBe(true);
  });

  it("séance sans exercice → écartée + warning droppedEmpty", () => {
    const { sessions, warnings } = parseLinesToProgram(["Lundi", "Mardi", "Squat 4x8"]);
    // Lundi vide écarté, Mardi garde le squat
    expect(sessions.length).toBe(1);
    expect(warnings.some((w) => w.code === "droppedEmpty")).toBe(true);
  });
});
