import { describe, it, expect } from "vitest";
import { activeCamp, inCamp } from "./camps.js";

const camp = (id, dateDebut, dateFin) => ({ id, dateDebut, dateFin });

describe("inCamp", () => {
  const c = camp("x", "2026-07-21", "2026-07-28");
  it("true inside the window (inclusive bounds)", () => {
    expect(inCamp(c, "2026-07-21")).toBe(true);
    expect(inCamp(c, "2026-07-25")).toBe(true);
    expect(inCamp(c, "2026-07-28")).toBe(true);
  });
  it("false outside the window", () => {
    expect(inCamp(c, "2026-07-20")).toBe(false);
    expect(inCamp(c, "2026-07-29")).toBe(false);
  });
  it("false for null camp", () => {
    expect(inCamp(null, "2026-07-25")).toBe(false);
  });
});

describe("activeCamp", () => {
  it("returns null when empty", () => {
    expect(activeCamp([])).toBe(null);
    expect(activeCamp(null)).toBe(null);
  });
  it("prefers the camp whose window contains today", () => {
    const past = camp("past", "2000-01-01", "2000-01-10");
    const now = camp("now", "2000-01-01", "2999-12-31"); // always contains today
    expect(activeCamp([past, now]).id).toBe("now");
  });
  it("falls back to the most recent (by start date) when none is current", () => {
    const older = camp("older", "2000-01-01", "2000-01-10");
    const newer = camp("newer", "2010-01-01", "2010-01-10");
    expect(activeCamp([older, newer]).id).toBe("newer");
  });
});
