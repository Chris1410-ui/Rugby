import { describe, it, expect } from "vitest";
import { RUGBY_POS, POS_GROUPS, posLabel, grpLabel } from "./positions.js";

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
});
