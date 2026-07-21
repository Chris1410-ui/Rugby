import { describe, it, expect } from "vitest";
import { rowsToObjects } from "./spreadsheet.js";

describe("spreadsheet — rowsToObjects", () => {
  it("mappe les lignes sur les en-têtes (défaut '' pour cellules absentes)", () => {
    const rows = [["Totem", "N°", "Poste"], ["Faucon", 7, "Ailier"], ["Loup", 3]];
    expect(rowsToObjects(rows)).toEqual([
      { "Totem": "Faucon", "N°": 7, "Poste": "Ailier" },
      { "Totem": "Loup", "N°": 3, "Poste": "" },
    ]);
  });
  it("ignore les lignes entièrement vides et les en-têtes vides", () => {
    const rows = [["A", "", "B"], ["x", "ignore", "y"], ["", "", ""], [" ", null, ""]];
    expect(rowsToObjects(rows)).toEqual([{ A: "x", B: "y" }]);
  });
  it("renvoie [] si pas de lignes de données", () => {
    expect(rowsToObjects([["A", "B"]])).toEqual([]);
    expect(rowsToObjects([])).toEqual([]);
    expect(rowsToObjects(null)).toEqual([]);
  });
});
