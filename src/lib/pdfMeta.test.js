import { describe, it, expect } from "vitest";
import { parsePdfDate, suggestProvenance } from "./pdfMeta.js";

describe("pdfMeta — parsePdfDate", () => {
  it("parse une date PDF standard", () => {
    expect(parsePdfDate("D:20230115120000Z")).toBe("2023-01-15");
    expect(parsePdfDate("20211231")).toBe("2021-12-31");
  });
  it("rejette les valeurs illisibles / hors bornes", () => {
    expect(parsePdfDate("")).toBeNull();
    expect(parsePdfDate("D:20231399")).toBeNull(); // mois/jour invalides
    expect(parsePdfDate(null)).toBeNull();
  });
});

describe("pdfMeta — suggestProvenance (jamais 'creation_propre' par défaut)", () => {
  it("auteur/producteur tiers → adapté d'une source", () => {
    expect(suggestProvenance({ author: "J. Dupont" })).toBe("adapte_source");
    expect(suggestProvenance({ producer: "Microsoft Word" })).toBe("adapte_source");
  });
  it("aucune métadonnée → origine inconnue (cas normal du PDF tiers)", () => {
    expect(suggestProvenance({})).toBe("origine_inconnue");
    expect(suggestProvenance({ author: "  " })).toBe("origine_inconnue");
  });
  it("ne suggère jamais creation_propre", () => {
    for (const m of [{}, { author: "x" }, { producer: "y" }, { creator: "z" }]) {
      expect(suggestProvenance(m)).not.toBe("creation_propre");
    }
  });
});
