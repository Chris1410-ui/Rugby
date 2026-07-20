import { describe, it, expect, beforeAll } from "vitest";
import i18n from "../i18n/config.js";
import { formatAnswer, questionnaireCSV, QUESTION_BANK, bankById } from "./questionnaires.js";

const t = i18n.t.bind(i18n);
beforeAll(async () => { await i18n.changeLanguage("fr"); });

describe("formatAnswer", () => {
  it("échelle → n/10", () => expect(formatAnswer({ type: "scale" }, 7)).toBe("7/10"));
  it("oui/non", () => {
    expect(formatAnswer({ type: "yesno" }, true)).toBe("Oui");
    expect(formatAnswer({ type: "yesno" }, false)).toBe("Non");
  });
  it("nombre avec unité", () => expect(formatAnswer({ type: "number", unit: "kg" }, 82)).toBe("82 kg"));
  it("vide → chaîne vide", () => {
    expect(formatAnswer({ type: "text" }, "")).toBe("");
    expect(formatAnswer({ type: "text" }, null)).toBe("");
  });
  it("liste répétable (blessures) → résumé lisible", () => {
    const q = bankById.blessures;
    const val = [{ type: "Entorse", zone: "Cheville", annee: 2023, opere: false, sequelles: "" }];
    const out = formatAnswer(q, val);
    expect(out).toContain("Type: Entorse");
    expect(out).toContain("Zone: Cheville");
    expect(out).toContain("Opéré ?: Non");
    expect(out).not.toContain("Séquelles"); // vide → omis
  });
});

describe("questionnaireCSV", () => {
  it("entête = questions, une ligne par joueur, échappe les guillemets", () => {
    const q = { nom: "Santé", questions: [{ id: "moral", type: "scale", label: "Moral" }, { id: "note", type: "text", label: "Note" }] };
    const rows = [
      { name: "Aigle", statut: "rempli", reponses: { moral: 8, note: 'dit "ok"' } },
      { name: "Loup", statut: "a_remplir", reponses: {} },
    ];
    const csv = questionnaireCSV(q, rows, t);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Joueur","Statut","Moral","Note"');
    expect(lines[1]).toContain('"Aigle","Rempli","8/10"');
    expect(lines[1]).toContain('"dit ""ok"""'); // guillemets échappés
    expect(lines[2]).toBe('"Loup","En attente","",""');
  });
});

describe("QUESTION_BANK", () => {
  it("couvre les 5 catégories de base + ids uniques", () => {
    const cats = new Set(QUESTION_BANK.map((q) => q.cat));
    ["physique", "mental", "blessures", "entrainement", "vie"].forEach((c) => expect(cats.has(c)).toBe(true));
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
  });
});
