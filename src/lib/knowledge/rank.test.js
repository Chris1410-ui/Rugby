import { describe, it, expect } from "vitest";
import { rankNotes, contextTerms, noteHaystack } from "./rank.js";

const notes = [
  { id: "a", theme: "prevention_nuque", title: "Renforcement cervical", body: "Isométrie nuque", confidence: 0.7 },
  { id: "b", theme: "nutrition", title: "Collation post-match", body: "Protéines et glucides", confidence: 0.9 },
  { id: "c", theme: "recuperation", title: "Sommeil et récupération", body: "Cohérence cardiaque", confidence: 0.5 },
];

describe("knowledge/rank", () => {
  it("thème exact prioritaire (+100)", () => {
    const out = rankNotes(notes, { theme: "prevention_nuque", terms: [] });
    expect(out[0].id).toBe("a");
    expect(out[0]._score).toBe(100);
  });

  it("mots-clés de contexte remontent le bon conseil", () => {
    const out = rankNotes(notes, { theme: "", terms: ["sommeil", "recuperation"] });
    expect(out[0].id).toBe("c");
    expect(out[0]._score).toBeGreaterThan(0);
  });

  it("départage par confiance à score égal", () => {
    const out = rankNotes(notes, { theme: "", terms: [] });
    expect(out.every((n) => n._score === 0)).toBe(true);
    expect(out[0].id).toBe("b"); // confiance 0.9
  });

  it("contextTerms filtre les mots courts et dédoublonne", () => {
    expect(contextTerms("Prévention de la nuque", "nuque")).toEqual(["prevention", "nuque"]);
  });

  it("noteHaystack normalise accents et casse", () => {
    expect(noteHaystack({ title: "Récupération", tags: ["Nuit"] })).toBe("recuperation nuit");
  });

  it("liste vide → tableau vide", () => {
    expect(rankNotes([], { theme: "x" })).toEqual([]);
    expect(rankNotes(null, {})).toEqual([]);
  });
});
