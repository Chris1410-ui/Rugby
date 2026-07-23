import { describe, it, expect } from "vitest";
import { NATURES, natureFromCode, effectiveNature, natureColor } from "./nature.js";

describe("nature de séance", () => {
  it("dérive une nature par défaut depuis le code rugby", () => {
    expect(natureFromCode("RS")).toBe("force");
    expect(natureFromCode("COD")).toBe("vitesse");
    expect(natureFromCode("CDD")).toBe("vitesse");   // legacy → vitesse
    expect(natureFromCode("CSB")).toBe("conditioning");
    expect(natureFromCode("CASB")).toBe("conditioning");
    expect(natureFromCode("AC")).toBe("technique");
    expect(natureFromCode("BLI")).toBe("prevention");
    expect(natureFromCode("???")).toBe("autre");
    expect(natureFromCode(undefined)).toBe("autre");
  });

  it("effectiveNature : valeur stockée prioritaire, sinon repli code-dérivé", () => {
    expect(effectiveNature("recuperation", "RS")).toBe("recuperation"); // explicite gagne
    expect(effectiveNature(null, "RS")).toBe("force");                  // repli code
    expect(effectiveNature("", "CSB")).toBe("conditioning");            // vide → repli
  });

  it("chaque défaut dérivé fait partie du vocabulaire contrôlé", () => {
    for (const code of ["RS", "COD", "CSB", "CASB", "AC", "BLI", "???"]) {
      expect(NATURES).toContain(natureFromCode(code));
    }
  });

  it("natureColor renvoie une couleur pour chaque nature (repli gris)", () => {
    for (const n of NATURES) expect(typeof natureColor(n)).toBe("string");
    expect(typeof natureColor("inconnue")).toBe("string");
  });
});
