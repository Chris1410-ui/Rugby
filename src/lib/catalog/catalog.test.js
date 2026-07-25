import { describe, it, expect } from "vitest";
import { detectSectionKind, hasSupersets, SECTION_KINDS } from "./detect.js";
import { fingerprint, dedupHash, jaccard, isNearDuplicate, sectionRefs, slug } from "./fingerprint.js";
import { objectiveOfKind, detectEquipment, extractTaxonomy } from "./taxonomy.js";
import { extractCandidates, dedupeCandidates, isMeaningfulSection } from "./extract.js";

// Fabriques minimales de sections (forme model.js allégée).
const exRow = (block, name, note = "") => ({ block, name, note, weeks: [{ text: "" }, { text: "" }] });
const exSection = (title, rows) => ({ type: "exercises", title, rows, weekLabels: ["S1", "S2"] });
const narrative = (title, body) => ({ type: "narrative", title, body });
const checklist = (title, items) => ({ type: "checklist", title, items });
const cardio = (title, items) => ({ type: "cardio", title, items });

describe("detectSectionKind — classification déterministe", () => {
  it("checklist / cardio / planning depuis le type structurel", () => {
    expect(detectSectionKind(checklist("Avant match", ["Protège-dents"]))).toBe("checklist");
    expect(detectSectionKind(cardio("Cardio", [{ name: "Course" }]))).toBe("cardio");
    expect(detectSectionKind({ type: "weekcalendar", days: [{ weekday: 1 }] })).toBe("planning");
  });
  it("prévention par mots-clés (nuque, proprio)", () => {
    expect(detectSectionKind(exSection("Renforcement nuque", [exRow("1", "Isométrie cervicale", "prévention commotion")]))).toBe("prevention");
  });
  it("cardio par mots-clés dans un tableau d'exercices", () => {
    expect(detectSectionKind(exSection("Filière", [exRow("1", "Fractionné 30/30 VMA")]))).toBe("cardio");
  });
  it("force par défaut pour un tableau sans mot-clé marquant", () => {
    expect(detectSectionKind(exSection("Bloc", [exRow("A1", "Back Squat")]))).toBe("strength");
  });
  it("superset : blocs couplés A1/A2 sur un tableau force", () => {
    const s = exSection("Bloc", [exRow("A1", "Squat"), exRow("A2", "Gainage"), exRow("B1", "Développé")]);
    expect(hasSupersets(s)).toBe(true);
    expect(detectSectionKind(s)).toBe("superset");
  });
  it("récupération / mobilité depuis un narratif", () => {
    expect(detectSectionKind(narrative("Récup", "Sommeil 8h, hydratation, retour au calme"))).toBe("recovery");
    expect(detectSectionKind(narrative("Souplesse", "Étirements et amplitude des hanches"))).toBe("mobility");
  });
  it("repli sur la nature du protocole pour un narratif neutre", () => {
    expect(detectSectionKind(narrative("Intro", "Texte générique sans indice particulier ici"), { nature: "force" })).toBe("strength");
    expect(detectSectionKind(narrative("Intro", "Texte générique sans indice particulier ici"))).toBe("note");
  });
  it("tous les kinds retournés font partie de SECTION_KINDS", () => {
    const k = detectSectionKind(exSection("x", [exRow("A1", "Squat")]));
    expect(SECTION_KINDS).toContain(k);
  });
});

describe("fingerprint / dedupHash — égalité structurelle", () => {
  it("deux sections identiques → même hash", () => {
    const a = exSection("Bloc force", [exRow("A1", "Back Squat"), exRow("A2", "Gainage")]);
    const b = exSection("Bloc force (copie)", [exRow("A1", "back squat"), exRow("A2", "GAINAGE")]);
    expect(dedupHash(fingerprint(a, "strength"))).toBe(dedupHash(fingerprint(b, "strength")));
  });
  it("des exercices différents → hash différent", () => {
    const a = exSection("Bloc", [exRow("A1", "Back Squat")]);
    const b = exSection("Bloc", [exRow("A1", "Soulevé de terre")]);
    expect(dedupHash(fingerprint(a, "strength"))).not.toBe(dedupHash(fingerprint(b, "strength")));
  });
  it("le kind fait partie du hash (même exos, kind différent → hash différent)", () => {
    const s = exSection("x", [exRow("1", "Course")]);
    expect(dedupHash(fingerprint(s, "cardio"))).not.toBe(dedupHash(fingerprint(s, "strength")));
  });
  it("sectionRefs privilégie exerciseRef puis le slug du nom, triés/dédupliqués", () => {
    const s = exSection("x", [exRow("A1", "Back Squat"), { block: "A2", name: "Squat", exerciseRef: "sq-01", weeks: [] }, exRow("A3", "Back Squat")]);
    expect(sectionRefs(s)).toEqual(["back-squat", "ex:sq-01"]);
  });
  it("slug insensible casse/accents", () => {
    expect(slug("Développé Couché")).toBe("developpe-couche");
  });
});

describe("jaccard / quasi-doublon", () => {
  it("jaccard = intersection/union", () => {
    expect(jaccard(["a", "b", "c"], ["a", "b"])).toBeCloseTo(2 / 3);
    expect(jaccard([], [])).toBe(1);
    expect(jaccard(["a"], ["b"])).toBe(0);
  });
  it("quasi-doublon : ≥ 0,8 d'intersection et même kind", () => {
    const fpA = { kind: "strength", refs: ["a", "b", "c", "d", "e"] };
    const fpB = { kind: "strength", refs: ["a", "b", "c", "d", "x"] }; // 4/6 = .67 → non
    expect(isNearDuplicate(fpA, fpB)).toBe(false);
    const fpC = { kind: "strength", refs: ["a", "b", "c", "d", "e"] };
    const fpD = { kind: "strength", refs: ["a", "b", "c", "d", "e", "f"] }; // 5/6 = .83 → oui
    expect(isNearDuplicate(fpC, fpD)).toBe(true);
    const fpE = { kind: "cardio", refs: ["a", "b", "c", "d", "e"] }; // kind différent
    expect(isNearDuplicate(fpC, fpE)).toBe(false);
  });
});

describe("taxonomie", () => {
  it("objectif dérivé du kind (vocabulaire nature)", () => {
    expect(objectiveOfKind("strength")).toBe("force");
    expect(objectiveOfKind("cardio")).toBe("conditioning");
    expect(objectiveOfKind("prevention")).toBe("prevention");
    expect(objectiveOfKind("inconnu")).toBe("autre");
  });
  it("matériel détecté par mots-clés", () => {
    const s = exSection("Bloc", [exRow("A1", "Développé haltères"), exRow("A2", "Tirage élastique")]);
    expect(detectEquipment(s)).toEqual(expect.arrayContaining(["elastique", "halteres"]));
  });
  it("matériel enrichi par la bibliothèque (exerciseIndex)", () => {
    const idx = new Map([["back-squat", { ref: "sq", equipment: "Barbell" }]]);
    const s = exSection("Bloc", [exRow("A1", "Back Squat")]);
    expect(detectEquipment(s, idx)).toContain("barbell");
  });
  it("extractTaxonomy renvoie la forme attendue", () => {
    const tax = extractTaxonomy(exSection("Cardio", [exRow("1", "Course VMA")]), "cardio");
    expect(tax).toMatchObject({ objective: "conditioning", positions: [], duration_min: null });
    expect(Array.isArray(tax.equipment)).toBe(true);
  });
});

describe("extractCandidates — pipeline complet", () => {
  const doc = {
    meta: { nature: "force" },
    sections: [
      exSection("Renforcement nuque", [exRow("1", "Isométrie cervicale", "prévention")]),
      exSection("Bloc", [exRow("A1", "Back Squat"), exRow("A2", "Gainage")]),
      narrative("", "   "),                                   // vide → ignorée
      exSection("Bloc (bis)", [exRow("A1", "back squat"), exRow("A2", "gainage")]), // doublon du 2e
    ],
  };

  it("ignore les sections vides et détecte kind + hash", () => {
    const cands = extractCandidates(doc);
    expect(cands).toHaveLength(3); // le narratif vide est écarté
    expect(cands[0].kind).toBe("prevention");
    expect(cands[1].kind).toBe("superset");
    expect(cands[0].name).toBe("Renforcement nuque");
  });
  it("le doublon interne partage le hash du bloc d'origine", () => {
    const cands = extractCandidates(doc);
    expect(cands[1].dedupHash).toBe(cands[2].dedupHash);
  });
  it("dedupeCandidates regroupe par hash et compte les occurrences", () => {
    const merged = dedupeCandidates(extractCandidates(doc));
    expect(merged).toHaveLength(2); // nuque + bloc (les 2 blocs fusionnés)
    const bloc = merged.find((c) => c.kind === "superset");
    expect(bloc.occurrences).toBe(2);
  });
  it("isMeaningfulSection : narratif court écarté, substantiel gardé", () => {
    expect(isMeaningfulSection(narrative("x", "trop court"))).toBe(false);
    expect(isMeaningfulSection(narrative("x", "Un paragraphe suffisamment long pour compter."))).toBe(true);
  });
});
