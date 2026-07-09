import { describe, it, expect } from "vitest";
import { slugify } from "./gdpr.js";
import { POLICY, POLICY_VERSION } from "../lib/policy.js";

describe("slugify (nom de fichier d'export)", () => {
  it("normalise accents, espaces et casse", () => {
    expect(slugify("Léa Dûpont")).toBe("lea-dupont");
  });
  it("réduit les séparateurs multiples et rogne les tirets", () => {
    expect(slugify("  Jean--Marc  ")).toBe("jean-marc");
  });
  it("retombe sur 'joueur' pour une entrée vide", () => {
    expect(slugify("")).toBe("joueur");
    expect(slugify(null)).toBe("joueur");
  });
});

describe("politique de confidentialité", () => {
  it("expose une version et des sections non vides", () => {
    expect(POLICY_VERSION).toBeTruthy();
    expect(POLICY.version).toBe(POLICY_VERSION);
    expect(POLICY.sections.length).toBeGreaterThan(0);
    for (const s of POLICY.sections) {
      expect(s.title).toBeTruthy();
      expect(s.body).toBeTruthy();
    }
  });
  it("couvre les droits RGPD (effacement / portabilité)", () => {
    const txt = POLICY.sections.map((s) => `${s.title} ${s.body}`).join(" ").toLowerCase();
    expect(txt).toContain("effacement");
    expect(txt).toContain("portabilité");
    expect(txt).toContain("consentement");
  });
});
