import { describe, it, expect } from "vitest";
import { playerAdherence, teamAdherence, ADHERENCE } from "./adherence.js";
import { RELIABILITY } from "./dataQuality.js";

const P = (id) => ({ id, name: `P${id}` });
// Séance prescrite assignée à `ids`, datée `date`, avec exercices optionnels.
const S = (id, date, ids, exercises = [], origin = "staff") => ({ id, date, origin, assignedIds: ids, exercises });
const today = "2024-03-31";

describe("playerAdherence", () => {
  it("compte done / missed / skipped sur la fenêtre et calcule le taux", () => {
    const p = P("a");
    const sessions = [
      S("s1", "2024-03-10", ["a"]),
      S("s2", "2024-03-12", ["a"]),
      S("s3", "2024-03-14", ["a"]),
      S("s4", "2024-03-16", ["a"]),
    ];
    const logs = {
      s1: { a: { status: "done" } },
      s2: { a: { status: "done" } },
      s3: { a: { status: "missed" } },
      // s4 : échue, aucun log → skipped
    };
    const r = playerAdherence(p, sessions, logs, today);
    expect(r.prescribed).toBe(4);
    expect(r.done).toBe(2);
    expect(r.missed).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.rate).toBeCloseTo(0.5, 5);
  });

  it("exclut le hors-fenêtre, le futur et les séances autonomes (origin libre)", () => {
    const p = P("a");
    const sessions = [
      S("old", "2024-01-01", ["a"]),          // hors fenêtre (28 j)
      S("future", "2024-04-10", ["a"]),        // futur
      S("libre", "2024-03-20", ["a"], [], "libre"), // autonome → non prescrit
      S("ok", "2024-03-20", ["a"]),
      S("other", "2024-03-20", ["b"]),         // pas assigné à a
    ];
    const logs = { ok: { a: { status: "done" } } };
    const r = playerAdherence(p, sessions, logs, today);
    expect(r.prescribed).toBe(1);
    expect(r.done).toBe(1);
    expect(r.rate).toBe(1);
  });

  it("rate null quand aucune séance prescrite", () => {
    const r = playerAdherence(P("a"), [], {}, today);
    expect(r.prescribed).toBe(0);
    expect(r.rate).toBeNull();
    expect(r.reliable).toBe(false);
  });

  it("mesure l'adhérence exercices (séries réalisées ≥ prescrites) sur les séances faites", () => {
    const p = P("a");
    const exos = [{ id: "e1", name: "Squat", sets: 4, reps: "5", charge: "100" }, { id: "e2", name: "Bench", sets: 3, reps: "8", charge: "60" }];
    const sessions = [S("s1", "2024-03-20", ["a"], exos)];
    const logs = {
      s1: { a: { status: "done", perExercise: {
        e1: { sets: [{ w: "100", reps: "5", done: true }, { w: "100", reps: "5", done: true }, { w: "100", reps: "5", done: true }, { w: "100", reps: "5", done: true }] }, // 4 ≥ 4 → adhered
        e2: { sets: [{ w: "60", reps: "8", done: true }, { w: "60", reps: "8", done: true }] }, // 2 < 3 → non adhered
      } } },
    };
    const r = playerAdherence(p, sessions, logs, today);
    expect(r.exercisePresc).toBe(2);
    expect(r.exerciseAdhered).toBe(1);
    expect(r.exerciseRate).toBeCloseTo(0.5, 5);
  });
});

describe("teamAdherence", () => {
  const windowSessions = (id, ids) => Array.from({ length: RELIABILITY.loadMinSessions }, (_, i) => S(`${id}-${i}`, `2024-03-${String(10 + i).padStart(2, "0")}`, ids));

  it("k-anon : masque l'agrégat d'équipe sous kAnonMin joueurs fiables", () => {
    const players = [P("a"), P("b")];
    const sessions = [...windowSessions("a", ["a"]), ...windowSessions("b", ["b"])];
    const logs = {};
    sessions.forEach((s) => { s.assignedIds.forEach((pid) => { (logs[s.id] = logs[s.id] || {})[pid] = { status: "done" }; }); });
    const r = teamAdherence({ players, sessions, logs, today });
    expect(r.team.nReliable).toBe(2);
    expect(r.kAnon).toBe(false); // 2 < 5
  });

  it("expose l'agrégat + trie les plus faibles en tête au-delà du seuil k-anon", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const players = ids.map(P);
    const sessions = [];
    ids.forEach((id) => sessions.push(...windowSessions(id, [id])));
    const logs = {};
    sessions.forEach((s) => {
      const pid = s.assignedIds[0];
      // « a » ne fait qu'une séance sur 6 (faible) ; les autres tout.
      const done = pid === "a" ? s.id.endsWith("-0") : true;
      (logs[s.id] = logs[s.id] || {})[pid] = { status: done ? "done" : "missed" };
    });
    const r = teamAdherence({ players, sessions, logs, today });
    expect(r.kAnon).toBe(true);
    expect(r.team.nReliable).toBe(5);
    expect(r.rows[0].id).toBe("a");           // plus faible en tête
    expect(r.rows[0].rate).toBeCloseTo(1 / RELIABILITY.loadMinSessions, 5);
    expect(r.belowIds).toContain("a");
    expect(r.belowIds).not.toContain("b");
    expect(r.lowRate).toBe(ADHERENCE.lowRate);
  });
});
