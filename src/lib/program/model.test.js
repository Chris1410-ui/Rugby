import { describe, it, expect } from "vitest";
import {
  emptyProgram, emptyRow, emptyExerciseSection, defaultWeekAccents, defaultWeekLabels,
  blockTint, slugify, normalizeProgram, changeWeeks, toc, clampWeeks,
} from "./model.js";

describe("protocole — fabriques", () => {
  it("emptyProgram a meta + sections vides", () => {
    const p = emptyProgram(4);
    expect(p.meta.weeks).toBe(4);
    expect(p.meta.weekLabels).toEqual(["S1", "S2", "S3", "S4"]);
    expect(Array.isArray(p.sections)).toBe(true);
    expect(p.sections).toHaveLength(0);
  });

  it("emptyRow a une cellule par semaine", () => {
    const r = emptyRow(3);
    expect(r.weeks).toHaveLength(3);
    expect(r.weeks[0]).toEqual({ text: "", peak: false });
    expect(r.exerciseRef).toBeNull();
    expect(typeof r.id).toBe("string");
  });

  it("emptyExerciseSection a labels + accents + une ligne", () => {
    const s = emptyExerciseSection(4);
    expect(s.type).toBe("exercises");
    expect(s.weekLabels).toHaveLength(4);
    expect(s.rows).toHaveLength(1);
  });
});

describe("protocole — accents & bornes semaines", () => {
  it("defaultWeekAccents(4) = cyan,cyan,ambre,fumée", () => {
    expect(defaultWeekAccents(4)).toEqual(["c", "c", "a", "m"]);
  });
  it("defaultWeekLabels(2) = S1,S2", () => {
    expect(defaultWeekLabels(2)).toEqual(["S1", "S2"]);
  });
  it("clampWeeks borne entre 1 et 12", () => {
    expect(clampWeeks(0)).toBe(1);
    expect(clampWeeks(99)).toBe(12);
    expect(clampWeeks(5)).toBe(5);
  });
  it("blockTint : A/B ambre, C/D cyan", () => {
    expect(blockTint("A1")).toBe("a");
    expect(blockTint("B2")).toBe("a");
    expect(blockTint("C1")).toBe("c");
    expect(blockTint("D1")).toBe("c");
  });
});

describe("protocole — slugify", () => {
  it("enlève accents et normalise", () => {
    expect(slugify("Cadre & objectifs")).toBe("cadre-objectifs");
    expect(slugify("Prévention")).toBe("prevention");
    expect(slugify("")).toBe("s");
  });
});

describe("protocole — normalizeProgram / changeWeeks", () => {
  it("répare un document partiel et assigne les ids", () => {
    const p = normalizeProgram({ sections: [{ type: "exercises", rows: [{ name: "Squat" }] }] }, 4);
    const row = p.sections[0].rows[0];
    expect(row.weeks).toHaveLength(4);
    expect(typeof row.id).toBe("string");
    expect(typeof p.sections[0].id).toBe("string");
    expect(p.meta.weeks).toBe(4);
  });

  it("changeWeeks redimensionne les grilles (tronque / complète)", () => {
    const p0 = normalizeProgram({
      sections: [{ type: "exercises", rows: [{ name: "Squat", weeks: [{ text: "4x8" }, { text: "4x6" }, { text: "5x5" }, { text: "3x5" }] }] }],
    }, 4);
    const p2 = changeWeeks(p0, 2);
    expect(p2.meta.weeks).toBe(2);
    expect(p2.sections[0].rows[0].weeks).toHaveLength(2);
    expect(p2.sections[0].rows[0].weeks[0].text).toBe("4x8");

    const p5 = changeWeeks(p0, 5);
    expect(p5.sections[0].rows[0].weeks).toHaveLength(5);
    expect(p5.sections[0].rows[0].weeks[4].text).toBe(""); // colonne ajoutée vide
  });

  it("préserve le pic (★) d'une cellule", () => {
    const p = normalizeProgram({ sections: [{ type: "exercises", rows: [{ name: "Squat", weeks: [{ text: "4x6", peak: true }] }] }] }, 1);
    expect(p.sections[0].rows[0].weeks[0].peak).toBe(true);
  });

  it("garde le texte d'une section narrative", () => {
    const p = normalizeProgram({ sections: [{ type: "narrative", title: "Cadre", body: "**Objectif**" }] }, 4);
    expect(p.sections[0].type).toBe("narrative");
    expect(p.sections[0].body).toBe("**Objectif**");
  });
});

describe("protocole — toc", () => {
  it("génère une entrée par section avec ancre stable", () => {
    const p = normalizeProgram({ sections: [{ type: "narrative", num: "01", title: "Cadre" }, { type: "exercises", title: "Musculation" }] }, 4);
    const t = toc(p);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ num: "01", title: "Cadre", anchor: "cadre-0" });
    expect(t[1].anchor).toBe("musculation-1");
  });
});
