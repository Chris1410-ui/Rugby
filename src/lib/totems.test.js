import { describe, it, expect } from "vitest";
import { TOTEMS, randomTotem, freeTotem, isTotemTaken } from "./totems.js";

describe("totems", () => {
  it("liste non vide et sans doublon", () => {
    expect(TOTEMS.length).toBeGreaterThan(8);
    expect(new Set(TOTEMS).size).toBe(TOTEMS.length);
  });
  it("liste sans doublon insensible à la casse", () => {
    const lower = TOTEMS.map((t) => t.toLowerCase());
    expect(new Set(lower).size).toBe(TOTEMS.length);
  });
  it("randomTotem() renvoie toujours un totem de la liste", () => {
    for (let i = 0; i < 30; i++) expect(TOTEMS).toContain(randomTotem());
  });
  it("randomTotem(index) est déterministe (bornage modulo)", () => {
    expect(randomTotem(0)).toBe(TOTEMS[0]);
    expect(randomTotem(TOTEMS.length)).toBe(TOTEMS[0]);
    expect(randomTotem(1)).toBe(TOTEMS[1]);
  });
});

describe("isTotemTaken — détection insensible à la casse / espaces", () => {
  it("détecte un totem déjà pris", () => {
    expect(isTotemTaken(["Aigle royal", "Lynx"], "aigle royal")).toBe(true);
    expect(isTotemTaken(["Aigle royal"], "  Aigle Royal  ")).toBe(true);
    expect(isTotemTaken(["Aigle royal"], "Bison")).toBe(false);
    expect(isTotemTaken([], "Bison")).toBe(false);
    expect(isTotemTaken(["Bison"], "")).toBe(false);
  });
});

describe("freeTotem — propose un totem libre", () => {
  it("renvoie le souhait s'il est libre", () => {
    expect(freeTotem(["Lynx"], "Bison")).toBe("Bison");
  });
  it("propose un totem inutilisé de la banque si le souhait est pris", () => {
    const res = freeTotem(["Minotaure"], "Minotaure");
    expect(res).not.toBe("Minotaure");
    expect(TOTEMS).toContain(res);
  });
  it("suffixe numéroté quand toute la banque est prise", () => {
    const res = freeTotem(TOTEMS, "Minotaure");
    expect(res).toBe("Minotaure 2");
  });
  it("ne renvoie jamais un totem déjà pris", () => {
    const taken = ["Minotaure", "renard futé", "SANGLIER"];
    const res = freeTotem(taken, "Renard futé");
    expect(taken.map((t) => t.toLowerCase())).not.toContain(res.toLowerCase());
  });
});
