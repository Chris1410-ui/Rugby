import { describe, it, expect, beforeAll } from "vitest";
import i18n from "../i18n/config.js";
import {
  acwrZ, wbToWellness, computeReadiness, playerLoad, enrichPlayers, computePoints, todayISO, buildAlerts,
  SLEEP_OPTIONS, sleepLabel, rankLeaderboard, alertText, alertCat,
} from "./metrics.js";

beforeAll(async () => { await i18n.changeLanguage("fr"); });

describe("rankLeaderboard — ex æquo (rang partagé + départage stable)", () => {
  const opts = { pointsOf: (r) => r.pts, labelOf: (r) => r.name, rankKey: "rank" };

  it("conserve TOUS les joueurs, même à égalité (aucune déduplication)", () => {
    const rows = [
      { id: "a", name: "Alice", pts: 30 },
      { id: "b", name: "Bob", pts: 30 },
      { id: "c", name: "Chloé", pts: 30 },
      { id: "d", name: "David", pts: 10 },
    ];
    const out = rankLeaderboard(rows, opts);
    expect(out).toHaveLength(4);
    expect(out.map((r) => r.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("rang PARTAGÉ puis saut (compétition : deux 3ᵉ → 5ᵉ)", () => {
    const rows = [
      { id: "1", name: "A", pts: 50 },
      { id: "2", name: "B", pts: 40 },
      { id: "3", name: "C", pts: 30 },
      { id: "4", name: "D", pts: 30 },
      { id: "5", name: "E", pts: 20 },
    ];
    const out = rankLeaderboard(rows, opts);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 3, 5]);
  });

  it("départage STABLE par nom pour les ex æquo (ordre déterministe)", () => {
    const a = [{ id: "z", name: "Zoé", pts: 20 }, { id: "a", name: "Aaron", pts: 20 }];
    const b = [{ id: "a", name: "Aaron", pts: 20 }, { id: "z", name: "Zoé", pts: 20 }];
    expect(rankLeaderboard(a, opts).map((r) => r.id)).toEqual(["a", "z"]);
    expect(rankLeaderboard(b, opts).map((r) => r.id)).toEqual(["a", "z"]); // même ordre quel que soit l'entrée
  });

  it("clé de rang configurable, items préservés (pas de mutation des points)", () => {
    const rows = [{ id: "x", name: "X", pts: 5 }];
    const out = rankLeaderboard(rows, { ...opts, rankKey: "scopeRank" });
    expect(out[0].scopeRank).toBe(1);
    expect(out[0].pts).toBe(5);
  });
});

describe("sélecteur de sommeil (tranches 30 min)", () => {
  it("options de 4h à 12h par pas de 0,5", () => {
    expect(SLEEP_OPTIONS[0]).toBe(4);
    expect(SLEEP_OPTIONS[SLEEP_OPTIONS.length - 1]).toBe(12);
    expect(SLEEP_OPTIONS).toHaveLength(17);
    expect(SLEEP_OPTIONS).toContain(7.5);
    // pas de 0,5 partout
    for (let i = 1; i < SLEEP_OPTIONS.length; i++) {
      expect(SLEEP_OPTIONS[i] - SLEEP_OPTIONS[i - 1]).toBeCloseTo(0.5);
    }
  });
  it("affichage humanisé « 7h30 » (pas « 7.5 »)", () => {
    expect(sleepLabel(7.5)).toBe("7h30");
    expect(sleepLabel(7)).toBe("7h");
    expect(sleepLabel(4)).toBe("4h");
    expect(sleepLabel(12)).toBe("12h");
    expect(sleepLabel(null)).toBe("—");
    expect(sleepLabel(undefined)).toBe("—");
  });
});

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
    expect(acwrZ(0.7).key).toBe("under");
    expect(acwrZ(0.8).key).toBe("target");
    expect(acwrZ(1.3).key).toBe("target");
    expect(acwrZ(1.4).key).toBe("watch");
    expect(acwrZ(1.5).key).toBe("watch");
    expect(acwrZ(1.6).key).toBe("over");
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
    expect(r.ev.some((e) => e.key === "session.done")).toBe(true);
    expect(r.div).toHaveProperty("key");
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
    expect(r.ev.some((e) => e.key === "session.postponed")).toBe(true);
  });

  it("activité déclarée : +10 par thématique", () => {
    const p = basePlayer({ acwr: 1.0 });
    const acts = [{ date: todayISO(), activities: ["salle", "course"] }];
    const r = computePoints(p, [], {}, acts);
    expect(r.pts).toBe(108 + 20); // 2 thématiques × 10
    expect(r.ev.some((e) => e.key === "activity" && e.params?.actKey === "salle")).toBe(true);
  });
  it("test Top 14 validé : +30 (crédité une fois)", () => {
    const p = basePlayer({ acwr: 1.0 });
    const r = computePoints(p, [], {}, [], [{ key: "yoyo", date: todayISO() }]);
    expect(r.pts).toBe(108 + 30);
    expect(r.ev.some((e) => e.key === "top14" && e.params?.testKey === "yoyo")).toBe(true);
  });
  it("tâche validée : +2 par tâche", () => {
    const p = basePlayer({ acwr: 1.0 });
    const r = computePoints(p, [], {}, [], [], [{ label: "Amener ses crampons", date: todayISO() }, { label: "RDV kiné", date: todayISO() }]);
    expect(r.pts).toBe(108 + 4); // 2 tâches × 2
    expect(r.ev.some((e) => e.key === "task" && e.params?.title === "Amener ses crampons")).toBe(true);
  });
  it("bilans complétés : +10 par bilan (matin/soir), sans double comptage activité", () => {
    const p = basePlayer({ acwr: 1.0 });
    const acts = [{ date: todayISO(), activities: ["salle"] }]; // +10 activité
    const bilans = [
      { date: todayISO(), moment: "matin" }, // +10
      { date: todayISO(), moment: "soir" },  // +10
    ];
    const r = computePoints(p, [], {}, acts, [], [], [], bilans);
    expect(r.pts).toBe(108 + 10 + 20); // activité (10) + matin (10) + soir (10)
  });
  it("défis confirmés : +N points paramétrables, datés", () => {
    const p = basePlayer({ acwr: 1.0 });
    const challenges = [
      { label: "100 passes", points: 25, date: todayISO() },
      { label: "Réveil musculaire", points: 15, date: todayISO() },
    ];
    const r = computePoints(p, [], {}, [], [], [], [], [], challenges);
    expect(r.pts).toBe(108 + 40); // 25 + 15
  });
  it("bonus top 2 réactivité : +15 par event", () => {
    const p = basePlayer({ acwr: 1.0 });
    const r = computePoints(p, [], {}, [], [], [], [{ date: todayISO() }]);
    expect(r.pts).toBe(108 + 15);
    expect(r.ev.some((e) => e.key === "reactivity")).toBe(true);
  });
});

describe("buildAlerts — clés stables (file de traitement)", () => {
  it("chaque alerte porte une clé identifiable", () => {
    const p = { ...basePlayer(), _load: { acwr: 1.7, monotony: 1 } };
    const alerts = buildAlerts([p], [], {}, {});
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => !!a.key)).toBe(true);
    expect(alerts.some((a) => a.key === "acwr-high")).toBe(true);
  });
  it("porte des params structurés, jamais de prose", () => {
    const p = { ...basePlayer(), _load: { acwr: 1.7, monotony: 1 } };
    const a = buildAlerts([p], [], {}, {}).find((x) => x.key === "acwr-high");
    expect(a.txt).toBeUndefined();
    expect(a.params).toEqual({ acwr: 1.7 });
  });
});

describe("alertText / alertCat — résolution i18n (FR)", () => {
  const t = i18n.t.bind(i18n);
  it("interpole une alerte live", () => {
    expect(alertText(t, { key: "acwr-high", params: { acwr: 1.7 } })).toBe("ACWR 1.7 — zone de surcharge");
  });
  it("gère le pluriel (séance/séances non validée·s)", () => {
    expect(alertText(t, { key: "overdue", params: { count: 1 } })).toBe("1 séance non validée");
    expect(alertText(t, { key: "overdue", params: { count: 3 } })).toBe("3 séances non validées");
  });
  it("résout une ligne persistée (akey + params)", () => {
    expect(alertText(t, { akey: "fatigue", params: { v: 9 } })).toBe("Fatigue déclarée 9/10");
  });
  it("repli sur la prose legacy si pas de params", () => {
    expect(alertText(t, { akey: "x", txt: "ancienne prose" })).toBe("ancienne prose");
  });
  it("traduit la catégorie", () => {
    expect(alertCat(t, "wellbeing")).toBe("Bien-être");
  });
});
