import { describe, it, expect } from "vitest";
import { CALISTHENICS_CATALOG, calisthenicsCandidates, CALISTHENICS_CATALOG_SOURCE } from "./catalog.js";

describe("calisthenics catalog bundle", () => {
  it("contient 13 séances + 4 programmes", () => {
    expect(CALISTHENICS_CATALOG.seances).toHaveLength(13);
    expect(CALISTHENICS_CATALOG.programmes).toHaveLength(4);
    expect(calisthenicsCandidates()).toHaveLength(17);
  });

  it("chaque candidat a un id stable préfixé cal:, un nom et une section typée", () => {
    for (const c of calisthenicsCandidates()) {
      expect(c.id).toMatch(/^cal:/);
      expect(c.name).toBeTruthy();
      expect(["exercises", "narrative"]).toContain(c.section.type);
    }
  });

  it("les séances sont des sections d'exercices avec des lignes prescrites", () => {
    for (const s of CALISTHENICS_CATALOG.seances) {
      expect(s.section.type).toBe("exercises");
      expect(s.section.rows.length).toBeGreaterThan(0);
      expect(s.section.rows[0].name).toBeTruthy();
    }
  });

  it("les programmes sont des notes narratives avec une semaine type", () => {
    for (const p of CALISTHENICS_CATALOG.programmes) {
      expect(p.section.type).toBe("narrative");
      expect(p.section.body).toMatch(/Jour 1/);
    }
  });

  it("ids uniques (pas de collision de dédup)", () => {
    const ids = calisthenicsCandidates().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("expose une source d'attribution", () => {
    expect(CALISTHENICS_CATALOG_SOURCE).toBeTruthy();
  });
});
