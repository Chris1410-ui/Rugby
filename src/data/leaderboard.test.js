import { describe, it, expect } from "vitest";
import { logsFromRows, checkinMapsFromRows } from "./leaderboard.js";

describe("leaderboard — reshapers RPC → computePoints", () => {
  it("logsFromRows : { [session][player] : { status, perExercise } }", () => {
    const out = logsFromRows([
      { session_id: "s1", player_id: "p1", status: "done", filled: true },
      { session_id: "s1", player_id: "p2", status: "missed", filled: false },
      { session_id: "s2", player_id: "p1", status: "postponed", filled: false },
    ]);
    expect(out.s1.p1.status).toBe("done");
    // filled=true → perExercise non vide (le test `.some(v=>v.reps)` de computePoints passe)
    expect(Object.values(out.s1.p1.perExercise).some((v) => v.reps)).toBe(true);
    expect(out.s1.p2.status).toBe("missed");
    expect(Object.keys(out.s1.p2.perExercise)).toHaveLength(0);
    expect(out.s2.p1.status).toBe("postponed");
  });

  it("checkinMapsFromRows : activités (non vides) + bilans (tous)", () => {
    const { activities, bilans } = checkinMapsFromRows([
      { player_id: "p1", checkin_date: "2026-07-17", moment: "matin", activities: ["salle"] },
      { player_id: "p1", checkin_date: "2026-07-17", moment: "soir", activities: [] },
      { player_id: "p2", checkin_date: "2026-07-16", moment: "matin", activities: [] },
    ]);
    // activités : seules les lignes non vides comptent
    expect(activities.p1).toEqual([{ date: "2026-07-17", activities: ["salle"] }]);
    expect(activities.p2).toBeUndefined();
    // bilans : chaque ligne = un bilan complété (matin/soir)
    expect(bilans.p1).toHaveLength(2);
    expect(bilans.p1.map((b) => b.moment).sort()).toEqual(["matin", "soir"]);
    expect(bilans.p2).toEqual([{ date: "2026-07-16", moment: "matin" }]);
  });

  it("entrées vides → objets vides", () => {
    expect(logsFromRows()).toEqual({});
    expect(checkinMapsFromRows()).toEqual({ activities: {}, bilans: {} });
  });
});
