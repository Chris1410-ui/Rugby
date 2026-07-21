import { describe, it, expect } from "vitest";
import { contractionPhases, MED_SESSIONS } from "./sessions.js";

describe("Jacobson modifié — phases de contraction globale", () => {
  const s = MED_SESSIONS.find((x) => x.id === "jacobsonGlobal");

  it("la séance existe et est de kind 'contraction'", () => {
    expect(s).toBeTruthy();
    expect(s.kind).toBe("contraction");
    expect(s.audio).toBe("jacobson-global");
  });

  it("déroule 3 cycles inspir/expir + 4ᵉ inspiration + contraction + relâchement", () => {
    const p = contractionPhases(s);
    // 3 × (inhale+exhale) = 6, puis inhale4, contract, release = 9 phases.
    expect(p.map((x) => x.type)).toEqual([
      "inhale", "exhale", "inhale", "exhale", "inhale", "exhale",
      "inhale4", "contract", "release",
    ]);
  });

  it("contraction 10 s, relâchement 15 s, respirations 5 s → 60 s par répétition", () => {
    const p = contractionPhases(s);
    const by = (ty) => p.filter((x) => x.type === ty);
    expect(by("contract")[0].sec).toBe(10);
    expect(by("release")[0].sec).toBe(15);
    expect(by("inhale4")[0].sec).toBe(5);
    expect(p.reduce((a, x) => a + x.sec, 0)).toBe(60);
  });
});
