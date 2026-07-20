import { describe, it, expect, beforeAll } from "vitest";
import i18n from "../i18n/config.js";
import { RUGBY_POS, POS_GROUPS, posLabel, grpLabel, posDisplay, posOptionLabel } from "./positions.js";

// Les libellés de ligne passent désormais par i18n (data.lines.*). On fige la
// langue sur FR pour des assertions déterministes (l'env de test expose parfois
// navigator.language = en).
beforeAll(async () => { await i18n.changeLanguage("fr"); });

describe("positions", () => {
  it("chaque poste a un numéro, un nom et une ligne valide", () => {
    RUGBY_POS.forEach((p) => {
      expect(p.num).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(["avants", "arrieres"]).toContain(p.grp);
    });
  });
  it("couvre les postes clés (grp déduit du poste)", () => {
    const byName = Object.fromEntries(RUGBY_POS.map((p) => [p.name, p]));
    expect(byName["Demi de mêlée"].grp).toBe("arrieres");
    expect(byName["Demi de mêlée"].num).toBe("9");
    expect(byName["Talonneur"].grp).toBe("avants");
    expect(byName["Arrière"].num).toBe("15");
  });
  it("posLabel = « numéro — nom »", () => {
    expect(posLabel({ num: "9", name: "Demi de mêlée" })).toBe("9 — Demi de mêlée");
  });
  it("POS_GROUPS sépare avants et arrières et conserve l'index d'origine", () => {
    const [av, ar] = POS_GROUPS;
    expect(av.label).toBe("Avants");
    expect(ar.label).toBe("Arrières");
    expect(av.items.length + ar.items.length).toBe(RUGBY_POS.length);
    av.items.forEach((p) => expect(RUGBY_POS[p.i].name).toBe(p.name));
  });
  it("grpLabel humanise la ligne", () => {
    expect(grpLabel("arrieres")).toBe("Arrières");
  });
  it("chaque poste porte une clé de traduction stable", () => {
    RUGBY_POS.forEach((p) => expect(p.key).toBeTruthy());
    expect(new Set(RUGBY_POS.map((p) => p.key)).size).toBe(RUGBY_POS.length);
  });
});

describe("posDisplay — mapping valeur stockée → libellé traduit", () => {
  const t = i18n.t.bind(i18n);
  it("traduit un poste connu (par sa valeur stockée = nom FR)", () => {
    expect(posDisplay(t, "Demi de mêlée")).toBe("Demi de mêlée"); // FR ici
    expect(posDisplay(t, "Arrière")).toBe("Arrière");
  });
  it("replie sur la valeur brute pour un poste inconnu (import/legacy)", () => {
    expect(posDisplay(t, "Libéro")).toBe("Libéro");
    expect(posDisplay(t, "")).toBe("");
    expect(posDisplay(t, undefined)).toBe("");
  });
  it("posOptionLabel = « num — nom traduit »", () => {
    const p = RUGBY_POS.find((x) => x.key === "demiMelee");
    expect(posOptionLabel(t, p)).toBe("9 — Demi de mêlée");
  });
});
