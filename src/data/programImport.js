import { extractPdfLines, parseLinesToProgram } from "../lib/pdf.js";
import { parseProgramAI } from "./programAI.js";
import { docToSessions } from "../lib/program/materialize.js";

/* Orchestrateur d'import d'un programme PDF — essaie l'analyse IA (sémantique,
   côté serveur), retombe sur le parseur regex local si l'IA n'est pas
   configurée / échoue. Ne LÈVE que sur un échec d'EXTRACTION du texte (pdf.js) :
   au-delà, on renvoie toujours un résultat exploitable pour l'aperçu (le parse
   reste faillible ; la validation manuelle reste la garantie).

   Renvoie une forme unifiée pour PdfImportReview :
   - mode:"ai"    → { doc, sessions, warnings, confidence }  (protocole riche +
                     séances dérivées éditables)
   - mode:"regex" → { sessions, warnings, unread }           (repli)
*/
export async function parseProgramSmart(file, { weeks = 4, filename = "" } = {}) {
  const lines = await extractPdfLines(file); // peut lever "no-pdfjs" → géré par l'appelant
  const text = (lines || []).join("\n");

  const ai = await parseProgramAI(text, { weeks, filename });
  if (ai.source === "claude" && ai.doc) {
    const { sessions, warnings: matWarn } = docToSessions(ai.doc);
    // Avertissements IA (texte libre) + avertissements de matérialisation.
    const warnings = [
      ...(ai.warnings || []).map((w) => ({ code: "ai", text: String(w) })),
      ...matWarn.map((w) => ({ code: "ai", text: w })),
    ];
    return { mode: "ai", doc: ai.doc, sessions, warnings, confidence: ai.confidence };
  }

  // Repli : parseur regex local sur les mêmes lignes déjà extraites.
  const r = parseLinesToProgram(lines);
  return { mode: "regex", ...r };
}
