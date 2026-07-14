import { describe, it, expect } from "vitest";
import { TOTEMS, randomTotem } from "./totems.js";

describe("totems", () => {
  it("liste non vide et sans doublon", () => {
    expect(TOTEMS.length).toBeGreaterThan(8);
    expect(new Set(TOTEMS).size).toBe(TOTEMS.length);
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
