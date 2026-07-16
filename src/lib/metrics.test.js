import { describe, it, expect } from "vitest";
import {
  acwrZ, wbToWellness, computeReadiness, playerLoad, enrichPlayers, computePoints, todayISO,
} from "./metrics.js";

const basePlayer = (over = {}) => ({
  id: "r_u18_1",
  name: "Test Joueur",
  num: 1,
  pos: "CENTRE",
  grp: "arrieres",
  acwr: 1.0,
  wellness: 35,
  sleep: 7.5,
  risque: 30,
  charge7j: 1800,
  dispo: 90,
  backSquat: 1.4,
  ischiosG: 300,
  ischiosD: 300,
  asym: 0,
  ...over,
});

describe("acwrZ — zones ACWR", () => {
  it("classe les 4 zones aux bons seuils", () => {
    expect(acwrZ(0.7).l).toBe("Sous-charge");
    expect(acwrZ(0.8).l).toBe("Cible");
    expect(acwrZ(1.3).l).toBe("Cible");
    expect(acwrZ(1.4).l).toBe("Vigilance");
    expect(acwrZ(1.5).l).toBe("Vigilance");
    expect(acwrZ(1.6).l).toBe("Surcharge");
  });
});

describe("wbToWellness — bien-être /50", () => {
  it("renvoie null sans bilan", () => {
    expect(wbToWellness(null)).toBe(null);
  });
  it("marqueurs au max → 50/50", () => {
    const wb = { energy: 10, mood: 10, fatigue: 0, soreness: 0, stress: 0, sleep: 9 };
    expect(wbToWellness(wb, 9)).toBe(50);
  });
  it("marqueurs médians → 29/50", () => {
    const wb = { energy: 5, mood: 5, fatigue: 5, soreness: 5, stress: 5, sleep: 5 };
    expect(wbToWellness(wb, 9)).toBe(29);
  });
  it("borne les valeurs hors échelle (clamp 0-10)", () => {
    const wb = { energy: 99, mood: 99, fatigue: -5, soreness: -5, stress: -5, sleep: 9 };
    expect(wbToWellness(wb, 9)).toBe(50);
  });
});

describe("computeReadiness — formule unique /100", () => {
  it("cas parfait = 100", () => {
    expect(computeReadiness(50, 0, 10)).toBe(100);
  });
  it("sleepH=0 retombe sur 7 (|| 7)", () => {
    expect(computeReadiness(0, 100, 0)).toBe(14); // 0 + 0 + 7/10*20
  });
  it("cas intermédiaire", () => {
    // 35/50*50=35 + (100-30)/100*30=21 + 7.5/10*20=15 → 71
    expect(computeReadiness(35, 30, 7.5)).toBe(71);
  });
});

describe("playerLoad — moteur de charge", () => {
  it("produit un historique de 42 jours et des indicateurs cohérents", () => {
    const L = playerLoad(basePlayer(), [], {});
    expect(L.hist).toHaveLength(42);
    expect(typeof L.acwr).toBe("number");
    expect(L.acwr).toBeGreaterThanOrEqual(0);
    expect(L.monotony).toBeGreaterThan(0);
    expect(L.zone).toHaveProperty("c");
  });
  it("est déterministe (même seed → même ACWR)", () => {
    const p = basePlayer();
    expect(playerLoad(p, [], {}).acwr).toBe(playerLoad(p, [], {}).acwr);
  });
});

describe("enrichPlayers — source de vérité unique", () => {
  it("readiness reste cohérent avec computeReadiness sur les valeurs dérivées", () => {
    const [e] = enrichPlayers([basePlayer()], [], {}, {});
    expect(e.readiness).toBe(computeReadiness(e.wellness, e.risque, e.sleep));
  });
  it("un bilan du jour (saved) écrase le wellness seed et passe _live=true", () => {
    const p = basePlayer({ wellness: 35 });
    const daily = {
      [p.id]: { saved: true, sleepH: 9, wb: { energy: 10, mood: 10, fatigue: 0, soreness: 0, stress: 0, sleep: 9 } },
    };
    const [e] = enrichPlayers([p], [], {}, daily);
    expect(e._live).toBe(true);
    expect(e.wellness).toBe(50); // wbToWellness max
  });
  it("deux dérivations successives donnent les mêmes indicateurs (pas de divergence)", () => {
    const p = basePlayer();
    const a = enrichPlayers([p], [], {}, {})[0];
    const b = enrichPlayers([p], [], {}, {})[0];
    expect([a.acwr, a.readiness, a.risque]).toEqual([b.acwr, b.readiness, b.risque]);
  });
});

describe("computePoints — gamification", () => {
  it("une séance validée crédite des points et journalise l'événement", () => {
    const p = basePlayer();
    const today = todayISO();
    const sessions = [{ id: "s1", date: today, assignedIds: [p.id] }];
    const logs = { s1: { [p.id]: { status: "done", rpe: 6, perExercise: { e1: { charge: 100 } } } } };
    const r = computePoints(p, sessions, logs);
    expect(r.pts).toBeGreaterThanOrEqual(0);
    expect(r.doneCount).toBe(1);
    expect(r.ev.some((e) => e.label === "Séance validée")).toBe(true);
    expect(r.div).toHaveProperty("l");
  });
  it("une séance passée non validée compte comme manquée", () => {
    const p = basePlayer();
    const sessions = [{ id: "s1", date: "2020-01-01", assignedIds: [p.id] }];
    const r = computePoints(p, sessions, {});
    expect(r.missedCount).toBe(1);
  });

  it("base = 100 fixe (déterministe, plus de base aléatoire par seed)", () => {
    // Deux joueurs d'ids différents, même ACWR, sans séance ni activité → même total.
    const a = computePoints(basePlayer({ id: "aaa", acwr: 1.0 }), [], {});
    const b = computePoints(basePlayer({ id: "zzz", acwr: 1.0 }), [], {});
    expect(a.pts).toBe(b.pts);
    // 100 base + 8 (ACWR en cible) = 108
    expect(a.pts).toBe(108);
  });

  it("séance du jour encore en attente : pas de pénalité (grace)", () => {
    const p = basePlayer({ acwr: 1.0 });
    const sessions = [{ id: "s1", date: todayISO(), assignedIds: [p.id] }];
    const r = computePoints(p, sessions, {});
    expect(r.missedCount).toBe(0);
    expect(r.pts).toBe(108); // inchangé vs aucune séance
  });

  it("séance reportée : ni gain ni pénalité, ne casse pas la série", () => {
    const p = basePlayer({ acwr: 1.0 });
    const sessions = [{ id: "s1", date: "2020-01-01", assignedIds: [p.id] }];
    const logs = { s1: { [p.id]: { status: "postponed" } } };
    const r = computePoints(p, sessions, logs);
    expect(r.missedCount).toBe(0);
    expect(r.pts).toBe(108); // aucune pénalité
    expect(r.ev.some((e) => e.label === "Séance reportée")).toBe(true);
  });

  it("activité déclarée : +10 par thématique", () => {
    const p = basePlayer({ acwr: 1.0 });
    const acts = [{ date: todayISO(), activities: ["salle", "course"] }];
    const r = computePoints(p, [], {}, acts);
    expect(r.pts).toBe(108 + 20); // 2 thématiques × 10
    expect(r.ev.some((e) => e.label === "Activité : Salle")).toBe(true);
  });
  it("test Top 14 validé : +30 (crédité une fois)", () => {
    const p = basePlayer({ acwr: 1.0 });
    const r = computePoints(p, [], {}, [], [{ label: "Yo-Yo IR1", date: todayISO() }]);
    expect(r.pts).toBe(108 + 30);
    expect(r.ev.some((e) => e.label === "Top 14 : Yo-Yo IR1")).toBe(true);
  });
});
