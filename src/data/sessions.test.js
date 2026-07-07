import { describe, it, expect } from "vitest";
import { resolveAssignedIds, dbToSession } from "./sessions.js";

const roster = [
  { id: "a", grp: "avants" },
  { id: "b", grp: "arrieres" },
  { id: "c", grp: "avants" },
];

describe("resolveAssignedIds — destinataires d'une séance", () => {
  it("mode 'all' → tout l'effectif", () => {
    expect(resolveAssignedIds({ mode: "all" }, roster)).toEqual(["a", "b", "c"]);
  });
  it("assigned absent → tout l'effectif", () => {
    expect(resolveAssignedIds(null, roster)).toEqual(["a", "b", "c"]);
  });
  it("mode 'group' → uniquement la ligne", () => {
    expect(resolveAssignedIds({ mode: "group", group: "avants" }, roster)).toEqual(["a", "c"]);
  });
  it("mode 'players' → la liste fournie", () => {
    expect(resolveAssignedIds({ mode: "players", ids: ["b"] }, roster)).toEqual(["b"]);
  });
});

describe("dbToSession — mapping ligne DB → forme applicative", () => {
  it("mappe program_id, exercises et résout assignedIds", () => {
    const row = {
      id: "s1",
      program_id: "p1",
      date: "2026-07-01",
      code: "RS",
      titre: "Force",
      duration_min: 75,
      exercises: [{ id: "e1", name: "Back Squat" }],
      assigned: { mode: "group", group: "avants" },
    };
    const s = dbToSession(row, roster);
    expect(s.programId).toBe("p1");
    expect(s.dur).toBe(75);
    expect(s.exercises).toHaveLength(1);
    expect(s.assignedIds).toEqual(["a", "c"]);
  });
});
