import { describe, it, expect } from "vitest";
import {
  TOP14_BENCH, posToCat, parseKg, broncoToSec, evalTest, top14Player, TOP14_TESTS, datedResultsFor,
} from "./top14.js";

const testByKey = Object.fromEntries(TOP14_TESTS.map((t) => [t.key, t]));

describe("top14 — seuils exacts", () => {
  it("reprend EXACTEMENT les valeurs du tableau", () => {
    expect(TOP14_BENCH.premiere).toMatchObject({ squat: 1.7, bench: 1.3, deadlift: 1.95, tractions: 0.25, bronco: 330, yoyo: 1400, cmj: 32 });
    expect(TOP14_BENCH.deuxieme).toMatchObject({ squat: 1.65, bench: 1.15, deadlift: 1.9, tractions: 0.3, bronco: 320, yoyo: 1500, cmj: 34 });
    expect(TOP14_BENCH.troisieme).toMatchObject({ squat: 1.75, bench: 1.3, deadlift: 2.0, tractions: 0.37, bronco: 305, yoyo: 1800, cmj: 38 });
    expect(TOP14_BENCH.charniere).toMatchObject({ squat: 1.75, bench: 1.3, deadlift: 2.1, tractions: 0.4, bronco: 285, yoyo: 2000, cmj: 40 });
    expect(TOP14_BENCH.centres).toMatchObject({ squat: 1.75, bench: 1.35, deadlift: 2.05, tractions: 0.42, bronco: 290, yoyo: 1900, cmj: 40 });
    expect(TOP14_BENCH.triangle).toMatchObject({ squat: 1.7, bench: 1.3, deadlift: 2.05, tractions: 0.43, bronco: 285, yoyo: 2000, cmj: 42 });
  });
});

describe("posToCat — mapping (ancien + nouveau libellé)", () => {
  it("mappe les postes app vers les 6 catégories", () => {
    expect(posToCat("Pilier gauche")).toBe("premiere");
    expect(posToCat("PILIER G")).toBe("premiere");
    expect(posToCat("Talonneur")).toBe("premiere");
    expect(posToCat("Deuxième ligne")).toBe("deuxieme");
    expect(posToCat("2e LIGNE")).toBe("deuxieme");
    expect(posToCat("Troisième ligne aile (flanker)")).toBe("troisieme");
    expect(posToCat("FLANKER")).toBe("troisieme");
    expect(posToCat("Troisième ligne centre (n°8)")).toBe("troisieme"); // pas Centres !
    expect(posToCat("N°8")).toBe("troisieme");
    expect(posToCat("Demi de mêlée")).toBe("charniere");
    expect(posToCat("Demi d'ouverture")).toBe("charniere");
    expect(posToCat("Trois-quarts centre")).toBe("centres");
    expect(posToCat("CENTRE")).toBe("centres");
    expect(posToCat("Ailier")).toBe("triangle");
    expect(posToCat("Arrière")).toBe("triangle");
  });
});

describe("parsers", () => {
  it("parseKg prend le dernier nombre (3x170 → 170)", () => {
    expect(parseKg("3x170")).toBe(170);
    expect(parseKg("170")).toBe(170);
    expect(parseKg("112.5")).toBe(112.5);
    expect(parseKg("")).toBeNull();
  });
  it("broncoToSec convertit m:ss / m'ss", () => {
    expect(broncoToSec("5:30")).toBe(330);
    expect(broncoToSec("4'45")).toBe(285);
    expect(broncoToSec("5'05")).toBe(305);
  });
});

describe("evalTest — sens de validation", () => {
  const bw = 100; // poids de corps → ×PdC direct
  it("force ≥ seuil = valide, % = valeur/seuil", () => {
    const r = { squat_5rm: "175", bodyweight: bw }; // 1.75 ×PdC
    const e = evalTest(testByKey.squat, r, "troisieme"); // seuil 1.75
    expect(e.valid).toBe(true);
    expect(Math.round(e.pct)).toBe(100);
  });
  it("bronco ≤ seuil = valide (plus bas = mieux)", () => {
    const under = evalTest(testByKey.bronco, { bronco: "5:00" }, "troisieme"); // 300 ≤ 305
    expect(under.valid).toBe(true);
    const over = evalTest(testByKey.bronco, { bronco: "5:30" }, "troisieme"); // 330 > 305
    expect(over.valid).toBe(false);
  });
  it("sans poids de corps, les ×PdC ne valident pas", () => {
    const e = evalTest(testByKey.squat, { squat_5rm: "175" }, "troisieme");
    expect(e.valid).toBe(false);
    expect(e.value).toBeNull();
  });
});

describe("top14Player — agrégat + anti-double-comptage", () => {
  it("un test validé produit un seul event daté de la 1re validation", () => {
    const dated = [
      { date: "2026-06-01", yoyo: 1700 }, // < 1800 (3e ligne) → pas validé
      { date: "2026-07-01", yoyo: 1850 }, // ≥ 1800 → validé (1re fois)
      { date: "2026-08-01", yoyo: 1900 }, // encore validé → PAS de 2e event
    ];
    const t = top14Player("Troisième ligne aile (flanker)", dated);
    const yoyoEvents = t.events.filter((e) => e.key === "yoyo");
    expect(yoyoEvents).toHaveLength(1);
    expect(yoyoEvents[0].date).toBe("2026-07-01");
    expect(t.byTest.yoyo.everValid).toBe(true);
    expect(t.count).toBeGreaterThanOrEqual(1);
  });
});

describe("datedResultsFor", () => {
  it("joint les résultats d'un joueur à la date de leur campagne", () => {
    const campaigns = [{ id: "c1", date: "2026-06-01" }, { id: "c2", date: "2026-07-01" }];
    const results = [
      { campaignId: "c1", playerId: "p1", yoyo: 1700 },
      { campaignId: "c2", playerId: "p1", yoyo: 1900 },
      { campaignId: "c1", playerId: "p2", yoyo: 1500 },
    ];
    const d = datedResultsFor(campaigns, results, "p1");
    expect(d).toHaveLength(2);
    expect(d[0].date).toBe("2026-06-01");
    expect(d[1].yoyo).toBe(1900);
  });
});
