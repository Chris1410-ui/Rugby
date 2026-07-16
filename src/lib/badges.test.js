import { describe, it, expect } from "vitest";
import {
  playerSessionTodo, playerTaskTodo, questionnaireTodo,
  staffTaskToConfirm, staffQuestionnaireTodo, activeAlertsCount,
} from "./badges.js";
import { fmtShort, fmtDay, parseISO } from "./metrics.js";

describe("parseISO / fmtShort — tolérant date seule + timestamp + repli", () => {
  it("parse une date seule (YYYY-MM-DD) à minuit local, sans décalage", () => {
    const d = parseISO("2026-07-16");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // juillet
    expect(d.getDate()).toBe(16);
  });
  it("parse un timestamp ISO complet (timestamptz) sans « Invalid Date »", () => {
    const d = parseISO("2026-07-16T19:17:00.000Z");
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(fmtShort("2026-07-16T19:17:00.000Z")).not.toBe("Invalid Date");
  });
  it("renvoie un repli « — » (jamais « Invalid Date ») si absent/illisible", () => {
    expect(fmtShort(null)).toBe("—");
    expect(fmtShort("")).toBe("—");
    expect(fmtShort("pas une date")).toBe("—");
    expect(fmtDay(undefined)).toBe("—");
    expect(fmtShort(null, "n/a")).toBe("n/a");
  });
});

describe("badges joueur", () => {
  const today = "2026-07-16";
  const sessions = [
    { id: "s1", date: today, assignedIds: ["me", "x"] },
    { id: "s2", date: today, assignedIds: ["me"] },
    { id: "s3", date: "2026-07-15", assignedIds: ["me"] }, // hier → ignoré
    { id: "s4", date: today, assignedIds: ["other"] },     // pas moi → ignoré
  ];
  const logs = { s1: { me: { status: "done" } } }; // s1 faite

  it("compte les séances du jour assignées non validées", () => {
    expect(playerSessionTodo(sessions, logs, "me", today)).toBe(1); // s2 seulement
  });

  it("compte les tâches où j'ai encore une action (a_faire)", () => {
    const tasks = [
      { id: "t1", assignedIds: ["me"] },
      { id: "t2", assignedIds: ["me"] },
      { id: "t3", assignedIds: ["other"] },
    ];
    const statutByTask = { t1: "validee_joueur" }; // t1 déjà faite (attente coach)
    expect(playerTaskTodo(tasks, statutByTask, "me")).toBe(1); // t2 (défaut a_faire)
  });

  it("compte les questionnaires non remplis", () => {
    const list = [{ statut: "rempli" }, { statut: "a_remplir" }, { statut: "a_remplir" }];
    expect(questionnaireTodo(list)).toBe(2);
  });
});

describe("badges staff", () => {
  it("compte les tâches en attente de confirmation coach", () => {
    const byTask = {
      t1: { p1: { statut: "validee_joueur" }, p2: { statut: "confirmee" } },
      t2: { p1: { statut: "validee_joueur" }, p3: { statut: "a_faire" } },
    };
    expect(staffTaskToConfirm(byTask)).toBe(2);
  });

  it("compte les assignations de questionnaires non remplies (équipe)", () => {
    const byQ = {
      q1: { p1: { statut: "rempli" }, p2: { statut: "a_remplir" } },
      q2: { p1: { statut: "a_remplir" }, p2: { statut: "a_remplir" } },
    };
    expect(staffQuestionnaireTodo(byQ)).toBe(3);
  });

  it("compte 0 alerte sur un effectif vide", () => {
    expect(activeAlertsCount([], [], {}, {}, [], "2026-07-16")).toBe(0);
  });
});
