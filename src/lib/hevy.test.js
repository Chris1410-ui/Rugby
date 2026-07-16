import { describe, it, expect } from "vitest";
import { parseChargeKg, prescribedVsRealized } from "./hevy.js";

describe("parseChargeKg", () => {
  it("parses plain and suffixed numbers", () => {
    expect(parseChargeKg("120")).toBe(120);
    expect(parseChargeKg("120 kg")).toBe(120);
    expect(parseChargeKg("120,5")).toBe(120.5);
  });
  it("returns null when not numeric", () => {
    expect(parseChargeKg("")).toBe(null);
    expect(parseChargeKg(null)).toBe(null);
    expect(parseChargeKg("PDC")).toBe(null);
  });
});

const set = (w, reps, done = true, type = "normal") => ({ w, reps, done, type });

describe("prescribedVsRealized", () => {
  const ex = { sets: "4", reps: "5", charge: "120" };

  it("no realized sets → hasRealized false, no diff", () => {
    const r = prescribedVsRealized(ex, { sets: [set("", "", false)] });
    expect(r.hasRealized).toBe(false);
    expect(r.diff).toBe(false);
  });

  it("identical to prescription → no diff", () => {
    const pe = { sets: Array.from({ length: 4 }, () => set(120, 5)) };
    const r = prescribedVsRealized(ex, pe);
    expect(r.hasRealized).toBe(true);
    expect(r.diff).toBe(false);
    expect(r.doneSets).toBe(4);
    expect(r.realTop).toBe(120);
  });

  it("fewer sets and lighter charge → diff with both flags", () => {
    const pe = { sets: [set(80, 5), set(80, 5), set(80, 5)] };
    const r = prescribedVsRealized(ex, pe);
    expect(r.diff).toBe(true);
    expect(r.setsDiff).toBe(true);
    expect(r.chargeDiff).toBe(true);
    expect(r.doneSets).toBe(3);
    expect(r.realTop).toBe(80);
    expect(r.prescCharge).toBe(120);
  });

  it("warmup sets don't count as realized working sets", () => {
    const pe = { sets: [set(60, 5, true, "warmup"), set(120, 5), set(120, 5), set(120, 5), set(120, 5)] };
    const r = prescribedVsRealized(ex, pe);
    expect(r.doneSets).toBe(4);
    expect(r.diff).toBe(false);
  });

  it("non-numeric prescribed charge → no chargeDiff", () => {
    const r = prescribedVsRealized({ sets: "3", reps: "8", charge: "" }, { sets: [set(80, 8), set(80, 8), set(80, 8)] });
    expect(r.chargeDiff).toBe(false);
    expect(r.diff).toBe(false);
  });
});
