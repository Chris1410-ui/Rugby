import { describe, it, expect } from "vitest";
import { parseProgressionCell, roundToIncrement, computeLoadKg, estimate1RM, movementIdentity, summarize1RM, movementTeamStats, pctMovements, missing1RMByMovement } from "./oneRM.js";

describe("pctMovements", () => {
  it("ne retient que les mouvements exprimés en % de 1RM", () => {
    const exos = [
      { name: "Squat", charge: "@80%" },
      { name: "Gainage", reps: "30s" },
      { name: "Développé couché", reps: "5×5 @75%" },
      { name: "Curl", charge: "20kg" },
    ];
    const out = pctMovements(exos);
    expect(out.map((m) => m.name).sort()).toEqual(["Développé couché", "Squat"]);
  });
  it("déduplique par exercise_id sinon par nom normalisé, ignore les vides", () => {
    const out = pctMovements([
      { name: "Squat", charge: "@80%", exerciseId: "x1" },
      { name: "squat", charge: "@70%", exerciseId: "x1" }, // même id → dédup
      { name: "  ", charge: "@70%" },                       // sans nom → ignoré
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "x1", name: "Squat" });
  });
});

describe("missing1RMByMovement", () => {
  const E = (playerId, exerciseId, label, valueKg) => ({ playerId, exerciseId, movementLabel: label, valueKg });
  it("groupe les manquants par mouvement, exclut ceux qui ont une mesure", () => {
    const entries = [
      E("p1", "ex1", "Squat", null),   // manquant
      E("p2", "ex1", "Squat", null),   // manquant
      E("p3", "ex1", "Squat", 120),    // mesuré → pas manquant
      E("p1", null, "Bench", null),    // manquant (par nom)
      E("p2", null, "Bench", 90),      // mesuré
    ];
    const out = missing1RMByMovement(entries);
    // Squat (2 manquants) avant Bench (1) — tri par nombre décroissant.
    expect(out.map((m) => [m.label, m.playerIds.length])).toEqual([["Squat", 2], ["Bench", 1]]);
    expect(out[0].playerIds.sort()).toEqual(["p1", "p2"]);
    expect(out[0].exerciseId).toBe("ex1");
  });
  it("un joueur avec placeholder ET mesure n'est pas compté manquant", () => {
    const out = missing1RMByMovement([
      { playerId: "p1", exerciseId: "ex1", movementLabel: "Squat", valueKg: null },
      { playerId: "p1", exerciseId: "ex1", movementLabel: "Squat", valueKg: 100 },
    ]);
    expect(out).toEqual([]);
  });
  it("restreint à l'effectif fourni", () => {
    const out = missing1RMByMovement([
      { playerId: "p1", exerciseId: "ex1", movementLabel: "Squat", valueKg: null },
      { playerId: "ghost", exerciseId: "ex1", movementLabel: "Squat", valueKg: null },
    ], ["p1"]);
    expect(out[0].playerIds).toEqual(["p1"]);
  });
});

describe("parseProgressionCell", () => {
  it("reconnaît sets×reps + @xx% + ★", () => {
    expect(parseProgressionCell("4×6 @75% ★")).toMatchObject({ sets: "4", reps: "6", pct: 75, star: true, abs: null });
  });
  it("charge absolue conservée (pas de pourcentage)", () => {
    expect(parseProgressionCell("4×8 @100kg")).toMatchObject({ sets: "4", reps: "8", pct: null, abs: "100kg" });
    expect(parseProgressionCell("3×5 80 kg")).toMatchObject({ pct: null, abs: "80kg" });
  });
  it("le pourcentage n'est jamais confondu avec une charge absolue", () => {
    expect(parseProgressionCell("5×5 @82.5%")).toMatchObject({ pct: 82.5, abs: null });
  });
  it("cellule sans schéma → champs vides, pas de crash", () => {
    expect(parseProgressionCell("")).toMatchObject({ sets: "", reps: "", pct: null, abs: null });
  });
  it("accepte les deux ordres @70% et 70%@", () => {
    expect(parseProgressionCell("4×8 @70%")).toMatchObject({ pct: 70, unknown: false });
    expect(parseProgressionCell("4×8 70%@")).toMatchObject({ pct: 70, unknown: false });
  });
  it("signale une syntaxe % non reconnue (au lieu de l'ignorer)", () => {
    expect(parseProgressionCell("4×8 @70")).toMatchObject({ pct: null, unknown: true });  // % manquant
    expect(parseProgressionCell("4×8 70 %")).toMatchObject({ pct: null, unknown: true });  // @ manquant
    expect(parseProgressionCell("4×8 R7")).toMatchObject({ unknown: false });               // rien à signaler
  });
  it("le * de multiplication n'est pas pris pour un pic ★", () => {
    expect(parseProgressionCell("4*8").star).toBe(false);
    expect(parseProgressionCell("4×6 ★").star).toBe(true);
  });
});

describe("movementTeamStats — moyenne + manquants", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const entries = [
    { playerId: "a", movementLabel: "Back Squat", valueKg: 120, measuredAt: "2026-02-01", createdAt: "2026-02-01" },
    { playerId: "a", movementLabel: "Back Squat", valueKg: 130, measuredAt: "2026-03-01", createdAt: "2026-03-01" }, // courant a = 130
    { playerId: "b", movementLabel: "back squat", valueKg: 110, measuredAt: "2026-02-01", createdAt: "2026-02-01" }, // même mouvement
  ];
  it("moyenne des 1RM courants + joueurs sans 1RM", () => {
    const s = movementTeamStats(entries, players, { name: "Back Squat" });
    expect(s.avg).toBe(120);        // (130 + 110) / 2
    expect(s.have).toBe(2);
    expect(s.missing).toBe(1);       // c n'a pas de 1RM
    expect(s.total).toBe(3);
  });
});

describe("roundToIncrement / computeLoadKg", () => {
  it("arrondit à 2,5 kg par défaut", () => {
    expect(roundToIncrement(83.6)).toBe(82.5);
    expect(roundToIncrement(84)).toBe(85);
    expect(roundToIncrement(84, 1.25)).toBe(83.75);
    expect(roundToIncrement(84, 5)).toBe(85);
  });
  it("charge = 1RM × % arrondie", () => {
    expect(computeLoadKg(70, 120)).toBe(85);   // 84 → 85 (2,5)
    expect(computeLoadKg(80, 120)).toBe(95);   // 96 → 95 (nearest 2,5)
    expect(computeLoadKg(85, 100)).toBe(85);   // 85 exact
  });
  it("1RM manquant ou % nul → null (jamais 0 ni charge fausse)", () => {
    expect(computeLoadKg(70, 0)).toBeNull();
    expect(computeLoadKg(70, null)).toBeNull();
    expect(computeLoadKg(0, 120)).toBeNull();
  });
});

describe("estimate1RM (Epley réutilisé)", () => {
  it("estime le 1RM depuis un sous-max", () => {
    expect(estimate1RM(100, 5)).toBe(Math.round(100 * (1 + 5 / 30))); // 117
    expect(estimate1RM(120, 1)).toBe(124);
  });
});

describe("movementIdentity — anti-doublon", () => {
  it("privilégie exercise_id, sinon la clé normalisée du nom", () => {
    expect(movementIdentity({ exerciseId: "abc" })).toBe("ex:abc");
    expect(movementIdentity({ name: "Hip thrust" })).toBe(movementIdentity({ name: "hip-thrust" }));
    expect(movementIdentity({ name: "Hip thrust" })).not.toBe(movementIdentity({ name: "Back squat" }));
  });
});

describe("summarize1RM — courant + historique + manquants", () => {
  const entries = [
    { movementLabel: "Back Squat", valueKg: 120, kind: "teste", measuredAt: "2026-01-10", createdAt: "2026-01-10" },
    { movementLabel: "back squat", valueKg: 130, kind: "teste", measuredAt: "2026-03-01", createdAt: "2026-03-01" }, // plus récent, même mouvement
    { movementLabel: "Hip thrust", valueKg: null, kind: "auto", measuredAt: null, createdAt: "2026-02-01" },          // placeholder
  ];
  it("regroupe par mouvement, prend la mesure la plus récente comme courant", () => {
    const s = summarize1RM(entries);
    const squat = s.find((x) => x.label.toLowerCase() === "back squat" || x.identity.includes("back"));
    // les deux « Back Squat » fusionnent (même clé) → courant = 130
    const sq = s.find((x) => x.value === 130);
    expect(sq).toBeTruthy();
    expect(sq.history).toHaveLength(2);       // historique conservé
    expect(sq.missing).toBe(false);
    expect(squat).toBeTruthy();
  });
  it("un placeholder sans mesure → missing = true", () => {
    const s = summarize1RM(entries);
    const hip = s.find((x) => x.label === "Hip thrust");
    expect(hip.missing).toBe(true);
    expect(hip.value).toBeNull();
  });
});
