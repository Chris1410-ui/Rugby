import { describe, it, expect } from "vitest";
import { effectiveAttendance, attendanceCounts, attendanceRate, attendancePointKind } from "./attendance.js";

describe("effectiveAttendance — le pointage staff prime", () => {
  it("staffStatus l'emporte sur la réponse joueur", () => {
    expect(effectiveAttendance({ staffStatus: "absent", playerResponse: "present" })).toBe("absent");
  });
  it("à défaut de pointage, la réponse joueur", () => {
    expect(effectiveAttendance({ playerResponse: "late" })).toBe("late");
  });
  it("sinon pending", () => {
    expect(effectiveAttendance({})).toBe("pending");
    expect(effectiveAttendance(null)).toBe("pending");
  });
});

describe("attendanceCounts", () => {
  it("compte les états effectifs sur les convoqués", () => {
    const convened = ["a", "b", "c", "d", "e"];
    const byPlayer = {
      a: { staffStatus: "present" },
      b: { playerResponse: "present" },
      c: { staffStatus: "absent", playerResponse: "present" },
      d: { playerResponse: "late" },
      // e : pas de ligne → pending
    };
    expect(attendanceCounts(convened, byPlayer)).toEqual({
      present: 2, late: 1, absent: 1, pending: 1, total: 5, responded: 3,
    });
  });
  it("robuste au vide", () => {
    expect(attendanceCounts([], {})).toMatchObject({ present: 0, total: 0, responded: 0 });
  });
});

describe("attendanceRate — pointage staff (vérité)", () => {
  it("présents+retards / pointés", () => {
    const rows = [
      { staffStatus: "present" }, { staffStatus: "late" }, { staffStatus: "absent" },
      { playerResponse: "present" }, // pas pointé → ignoré
    ];
    expect(attendanceRate(rows)).toBe(67); // 2/3
  });
  it("null sans aucun pointage", () => {
    expect(attendanceRate([{ playerResponse: "present" }])).toBeNull();
    expect(attendanceRate([])).toBeNull();
  });
});

describe("attendancePointKind — miroir de team_training_events", () => {
  it("présent / retard", () => {
    expect(attendancePointKind({ staffStatus: "present" })).toBe("present");
    expect(attendancePointKind({ staffStatus: "late" })).toBe("late");
  });
  it("absence non annoncée = event ; annoncée = neutre", () => {
    expect(attendancePointKind({ staffStatus: "absent" })).toBe("absentUnannounced");
    expect(attendancePointKind({ staffStatus: "absent", playerResponse: "present" })).toBe("absentUnannounced");
    expect(attendancePointKind({ staffStatus: "absent", playerResponse: "absent" })).toBeNull();
  });
  it("pas de pointage = pas d'event", () => {
    expect(attendancePointKind({ playerResponse: "present" })).toBeNull();
    expect(attendancePointKind({})).toBeNull();
  });
});
