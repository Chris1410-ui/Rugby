import { describe, it, expect } from "vitest";
import { RELIABILITY, loadReliability, teamDataCompleteness } from "./dataQuality.js";
import { isoDate } from "./metrics.js";

const today = "2026-07-26";
const dAgo = (n) => isoDate(new Date(2026, 6, 26 - n)); // n jours avant today

const P = { id: "p1" };
const sess = (id, dayAgo) => ({ id, date: dAgo(dayAgo), assignedIds: ["p1"] });

describe("dataQuality — fiabilité de la charge", () => {
  it("compte les séances loggées « done » de la fenêtre", () => {
    const sessions = [sess("s1", 2), sess("s2", 5), sess("s3", 40)]; // s3 hors fenêtre 28j
    const logs = { s1: { p1: { status: "done" } }, s2: { p1: { status: "done" } }, s3: { p1: { status: "done" } } };
    const r = loadReliability(P, sessions, logs, today);
    expect(r.n).toBe(2);           // s3 exclue (40 j > 28)
    expect(r.reliable).toBe(false); // < 6
  });

  it("fiable au-delà du seuil", () => {
    const sessions = Array.from({ length: 7 }, (_, i) => sess(`s${i}`, i + 1));
    const logs = {};
    sessions.forEach((s) => { logs[s.id] = { p1: { status: "done" } }; });
    expect(loadReliability(P, sessions, logs, today).reliable).toBe(true);
  });
});

describe("dataQuality — déficits de saisie du club", () => {
  const players = [{ id: "p1" }, { id: "p2" }];
  it("repère durée manquante, 1RM manquant, bilan absent, charge non fiable", () => {
    const sessions = [{ id: "s1", date: dAgo(1), assignedIds: ["p1", "p2"] }];
    const logs = {
      s1: {
        p1: { status: "done", duration: 60 }, // p1 a saisi une durée
        p2: { status: "done" },               // p2 : done sans durée
      },
    };
    const oneRM = [{ playerId: "p1", valueKg: 120 }]; // seul p1 a un 1RM
    const bilans = { p1: [{ date: dAgo(1) }] };        // seul p1 a un bilan récent
    const dq = teamDataCompleteness({ players, sessions, logs, oneRM, bilans, today });

    expect(dq.total).toBe(2);
    expect(dq.noDuration.ids).toEqual(["p2"]);
    expect(dq.no1RM.ids).toEqual(["p2"]);
    expect(dq.noBilan.ids).toEqual(["p2"]);
    expect(dq.lowLog.ids).toEqual(["p1", "p2"]); // < 6 séances loggées → tous non fiables
  });

  it("entrées vides → aucun déficit sur 0 joueur", () => {
    const dq = teamDataCompleteness({ players: [], today });
    expect(dq.total).toBe(0);
    expect(dq.noDuration.n).toBe(0);
  });

  it("expose les seuils confirmés", () => {
    expect(RELIABILITY).toMatchObject({ loadMinSessions: 6, trendMinPoints: 3, kAnonMin: 5, loadWindowDays: 28 });
  });
});
