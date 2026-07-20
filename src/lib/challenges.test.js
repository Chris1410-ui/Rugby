import { describe, it, expect, beforeAll } from "vitest";
import i18n from "../i18n/config.js";
import { challengeBadges, topChallengeBadge, defiOfWeek, CHALLENGE_BANNERS, assignedLabel } from "./challenges.js";

// assignedLabel compose grpLabel (data.lines.* via i18n) → on fige FR pour des
// assertions déterministes (l'env de test peut exposer navigator.language = en).
beforeAll(async () => { await i18n.changeLanguage("fr"); });

describe("badges de défis (paliers 1/5/10/25)", () => {
  it("débloque les paliers selon le nombre de défis confirmés", () => {
    expect(challengeBadges(0)).toEqual([]);
    expect(challengeBadges(1).map((b) => b.n)).toEqual([1]);
    expect(challengeBadges(7).map((b) => b.n)).toEqual([1, 5]);
    expect(challengeBadges(30).map((b) => b.n)).toEqual([1, 5, 10, 25]);
  });
  it("topChallengeBadge = plus haut palier atteint", () => {
    expect(topChallengeBadge(0)).toBe(null);
    expect(topChallengeBadge(3).n).toBe(1);
    expect(topChallengeBadge(12).n).toBe(10);
  });
});

describe("defiOfWeek", () => {
  it("prend le défi actif le plus récent (échéance non dépassée)", () => {
    const today = "2026-07-17";
    const list = [
      { id: "a", echeance: "2026-07-10" },   // dépassé
      { id: "b", echeance: "2026-07-20" },   // actif, le plus récent en tête
      { id: "c", echeance: null },
    ];
    expect(defiOfWeek(list, today).id).toBe("b");
  });
  it("repli sur le plus récent si tous dépassés", () => {
    expect(defiOfWeek([{ id: "a", echeance: "2020-01-01" }], "2026-07-17").id).toBe("a");
    expect(defiOfWeek([], "2026-07-17")).toBe(null);
  });
});

describe("bannières réutilisées des équipes", () => {
  it("la palette n'est pas vide", () => {
    expect(CHALLENGE_BANNERS.length).toBeGreaterThan(4);
  });
});

describe("assignedLabel (destinataires lisibles)", () => {
  it("mappe chaque mode d'assignation", () => {
    expect(assignedLabel({ mode: "all" })).toBe("Toute l'équipe");
    expect(assignedLabel({ mode: "open" })).toBe("Ouvert à tous");
    expect(assignedLabel({ mode: "group", group: "avants" })).toBe("Ligne · Avants");
    expect(assignedLabel({ mode: "players", ids: ["a", "b", "c"] })).toBe("Joueurs choisis · 3");
  });
  it("valeurs par défaut robustes", () => {
    expect(assignedLabel()).toBe("Toute l'équipe");
    expect(assignedLabel({ mode: "players" })).toBe("Joueurs choisis · 0");
  });
});
