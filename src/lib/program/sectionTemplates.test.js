import { describe, it, expect } from "vitest";
import { BUILTIN_SECTION_TEMPLATES, freshSection } from "./sectionTemplates.js";

describe("modèles de sections fournis", () => {
  it("expose 3 modèles avec fabrique + libellé", () => {
    expect(BUILTIN_SECTION_TEMPLATES).toHaveLength(3);
    BUILTIN_SECTION_TEMPLATES.forEach((tpl) => {
      expect(typeof tpl.build).toBe("function");
      expect(typeof tpl.nameKey).toBe("string");
    });
  });

  it("Cardio : une section d'exercices, grille au bon nombre de semaines", () => {
    const [sec] = BUILTIN_SECTION_TEMPLATES.find((t) => t.id === "cardio").build(3);
    expect(sec.type).toBe("exercises");
    expect(sec.rows.length).toBeGreaterThan(0);
    expect(sec.rows[0].weeks).toHaveLength(3); // tronqué à 3 semaines
  });

  it("Récupération : deux sections (narrative + exercices)", () => {
    const secs = BUILTIN_SECTION_TEMPLATES.find((t) => t.id === "recovery").build(4);
    expect(secs).toHaveLength(2);
    expect(secs[0].type).toBe("narrative");
    expect(secs[0].body).toContain("Sommeil");
    expect(secs[1].type).toBe("exercises");
  });

  it("Renforcement : blocs A1/A2/B1 avec un pic en S2", () => {
    const [sec] = BUILTIN_SECTION_TEMPLATES.find((t) => t.id === "strength").build(4);
    const blocks = sec.rows.map((r) => r.block);
    expect(blocks).toContain("A1");
    expect(blocks).toContain("B1");
    expect(sec.rows[0].weeks[1].peak).toBe(true); // S2 top set
  });

  it("freshSection régénère les ids (insertion multiple)", () => {
    const [sec] = BUILTIN_SECTION_TEMPLATES.find((t) => t.id === "cardio").build(4);
    const a = freshSection(sec), b = freshSection(sec);
    expect(a.id).not.toBe(b.id);
    expect(a.rows[0].id).not.toBe(b.rows[0].id);
    expect(a.rows[0].name).toBe(sec.rows[0].name); // contenu préservé
  });
});
