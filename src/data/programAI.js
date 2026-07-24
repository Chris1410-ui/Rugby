import { supabase } from "../lib/supabase.js";
import { normalizeProgram } from "../lib/program/model.js";

/* Analyse IA d'un programme — invoque l'Edge Function `parse-program`.
   L'appel à Claude et la clé API restent CÔTÉ SERVEUR (jamais exposés au
   navigateur). La fonction renvoie un document structuré (modèle protocole
   étendu) ; on le NORMALISE ici pour garantir une forme stable avant aperçu.

   Renvoie :
   - { source:"claude", doc, warnings, confidence } en cas de succès ;
   - { source:"fallback", note } si l'IA n'est pas configurée / a échoué —
     l'appelant retombe alors sur le parseur regex local (lib/pdf.js).
   Ne LÈVE PAS sur un échec IA : l'aperçu + validation manuelle restent la
   garantie (le parse reste faillible, quel que soit le moteur). */
export async function parseProgramAI(text, { weeks = 4, filename = "" } = {}) {
  const clean = String(text || "").trim();
  if (!clean) return { source: "fallback", note: "empty_text" };

  let data;
  try {
    const res = await supabase.functions.invoke("parse-program", {
      body: { text: clean, weeks, filename },
    });
    if (res.error) return { source: "fallback", note: "invoke_error" };
    data = res.data;
  } catch {
    return { source: "fallback", note: "network" };
  }

  if (!data || data.source !== "claude" || !data.doc) {
    return { source: "fallback", note: data?.note || "no_doc" };
  }

  const doc = normalizeProgram(data.doc, data.doc?.meta?.weeks ?? weeks);
  return {
    source: "claude",
    doc,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    confidence: typeof data.confidence === "number" ? data.confidence : null,
  };
}
