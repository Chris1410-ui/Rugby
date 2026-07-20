import { describe, it, expect, beforeAll } from "vitest";
import i18n from "../i18n/config.js";
import { rosterCSV } from "./csv.js";

const t = i18n.t.bind(i18n);
beforeAll(async () => { await i18n.changeLanguage("fr"); });

describe("rosterCSV — export i18n", () => {
  const players = [
    { num: 9, name: "Aigle", pos: "Demi de mêlée", grp: "arrieres", acwr: 1.6, charge7j: 1800, monotonie: 1.2, strain: 2100, wellness: 40, readiness: 72, risque: 55, _live: true },
    { num: 1, name: "Ours", pos: "Poste inconnu", grp: "avants", acwr: 1.0, charge7j: 1500, monotonie: 1, strain: 1500, wellness: 45, readiness: 80, risque: 20, _live: false },
  ];

  it("traduit les en-têtes (FR)", () => {
    const [header] = rosterCSV(players, t);
    expect(header[0]).toBe("N°");
    expect(header[2]).toBe("Poste");
    expect(header[3]).toBe("Ligne");
    expect(header[5]).toBe("Zone");
    expect(header[12]).toBe("Bilan du jour");
  });

  it("traduit poste (repli si inconnu), ligne, zone ACWR et oui/non", () => {
    const [, r1, r2] = rosterCSV(players, t);
    expect(r1[2]).toBe("Demi de mêlée");   // poste connu → libellé traduit
    expect(r1[3]).toBe("Arrières");        // ligne
    expect(r1[5]).toBe("Surcharge");       // acwr 1.6 → zone
    expect(r1[12]).toBe("oui");            // _live
    expect(r2[2]).toBe("Poste inconnu");   // repli sur la valeur brute
    expect(r2[5]).toBe("Cible");           // acwr 1.0
    expect(r2[12]).toBe("non");
  });

  it("préserve les valeurs numériques brutes (non traduites)", () => {
    const [, r1] = rosterCSV(players, t);
    expect(r1[0]).toBe(9);
    expect(r1[4]).toBe(1.6);   // ACWR brut
    expect(r1[6]).toBe(1800);  // charge
  });
});
