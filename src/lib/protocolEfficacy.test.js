import { describe, it, expect } from "vitest";
import { programEfficacy, EFFICACY } from "./protocolEfficacy.js";

// Séance d'un programme, datée.
const S = (id, progId, date) => ({ id, programId: progId, date });
// Ligne perf : est_1rm mesuré sur un exercice lors d'une séance.
const R = (sessionId, playerId, key, est1rm, date) => ({ sessionId, playerId, exerciseKey: key, exerciseName: key, est1rm, date });

// Génère minPoints mesures pour un joueur sur un exercice, du first au last (progression linéaire).
function series(prog, pid, key, first, last, base = "2024-03-1") {
  const n = EFFICACY.minPoints;
  const sessions = [], perf = [];
  for (let i = 0; i < n; i++) {
    const day = `${base}${i}`; // 2024-03-10, -11, ...
    const sid = `${prog}-${pid}-${key}-${i}`;
    sessions.push(S(sid, prog, day));
    const v = Math.round(first + ((last - first) * i) / (n - 1));
    perf.push(R(sid, pid, key, v, day));
  }
  return { sessions, perf };
}

describe("programEfficacy", () => {
  it("calcule le Δ 1RM du premier au dernier point, gaté à minPoints mesures/joueur", () => {
    const prog = { id: "p1", title: "Bloc force", start: "2024-03-01" };
    const s = series("p1", "a", "squat", 100, 110);
    const res = programEfficacy({ programs: [prog], sessions: s.sessions, perf: s.perf });
    const ex = res[0].exercises.find((e) => e.key === "squat");
    expect(ex.nPlayers).toBe(1);
    expect(ex.meanDelta).toBe(10);
    expect(ex.meanPct).toBeCloseTo(10, 5);
    expect(ex.nImproved).toBe(1);
  });

  it("ignore un joueur avec trop peu de mesures", () => {
    const prog = { id: "p1", title: "x", start: "2024-03-01" };
    const sessions = [S("s1", "p1", "2024-03-10"), S("s2", "p1", "2024-03-12")];
    const perf = [R("s1", "a", "bench", 80, "2024-03-10"), R("s2", "a", "bench", 90, "2024-03-12")]; // 2 < minPoints(3)
    const res = programEfficacy({ programs: [prog], sessions, perf });
    const ex = res[0].exercises.find((e) => e.key === "bench");
    expect(ex.nPlayers).toBe(0);
    expect(ex.meanDelta).toBeNull();
    expect(ex.reliable).toBe(false);
  });

  it("k-anon : reliable seulement à partir de minPlayers joueurs", () => {
    const prog = { id: "p1", title: "x", start: "2024-03-01" };
    let sessions = [], perf = [];
    for (let k = 0; k < EFFICACY.minPlayers; k++) {
      const s = series("p1", `pl${k}`, "squat", 100, 105 + k);
      sessions = sessions.concat(s.sessions); perf = perf.concat(s.perf);
    }
    const res = programEfficacy({ programs: [prog], sessions, perf });
    const ex = res[0].exercises.find((e) => e.key === "squat");
    expect(ex.nPlayers).toBe(EFFICACY.minPlayers);
    expect(ex.reliable).toBe(true);
    expect(res[0].reliableCount).toBe(1);
    expect(res[0].meanPct).not.toBeNull();
  });

  it("exclut les séances hors programme et trie les programmes du plus récent au plus ancien", () => {
    const older = { id: "old", title: "Ancien", start: "2024-01-01" };
    const newer = { id: "new", title: "Récent", start: "2024-05-01" };
    const s = series("new", "a", "squat", 100, 110);
    // séance sans programId → ignorée
    const orphan = R("orphan", "a", "squat", 200, "2024-05-10");
    const res = programEfficacy({ programs: [older, newer], sessions: [...s.sessions, S("orphan", null, "2024-05-10")], perf: [...s.perf, orphan] });
    expect(res[0].program.id).toBe("new"); // plus récent en tête
    expect(res[1].program.id).toBe("old");
    expect(res[1].exercises.length).toBe(0); // aucune donnée
  });
});
