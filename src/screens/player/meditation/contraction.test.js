import { describe, it, expect } from "vitest";
import { contractionPhases, MED_SESSIONS, AUDIO_CUES } from "./sessions.js";

describe("Jacobson modifié — phases de contraction globale", () => {
  const s = MED_SESSIONS.find((x) => x.id === "jacobsonGlobal");

  it("la séance existe et est de kind 'contraction'", () => {
    expect(s).toBeTruthy();
    expect(s.kind).toBe("contraction");
    expect(typeof s.audio).toBe("string"); // nom de base du fichier audio (bucket public)
    expect(s.cues).toBe("jacobsonGlobal");
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

describe("Jacobson modifié — cue sheet audio (jacobson-global)", () => {
  const cues = AUDIO_CUES.jacobsonGlobal;

  it("timestamps strictement croissants et se termine par 'end'", () => {
    for (let i = 1; i < cues.length; i++) expect(cues[i].t).toBeGreaterThan(cues[i - 1].t);
    expect(cues[cues.length - 1].type).toBe("end");
  });

  it("3 phases de contraction (hold) d'environ 11–12 s chacune", () => {
    const holds = cues.map((c, i) => ({ c, i })).filter((x) => x.c.type === "hold");
    expect(holds).toHaveLength(3);
    for (const { c, i } of holds) {
      const len = cues[i + 1].t - c.t;
      expect(len).toBeGreaterThanOrEqual(10);
      expect(len).toBeLessThanOrEqual(13);
    }
    // Les 3 blocages annoncés : 65,9 / 126,3 / 185,3 s.
    expect(holds.map((h) => h.c.t)).toEqual([65.9, 126.3, 185.3]);
  });
});
