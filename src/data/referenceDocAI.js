import { supabase } from "../lib/supabase.js";

/* Analyse IA d'un document de référence — invoque l'Edge Function
   `analyze-reference-doc`. L'appel à Claude et la clé API restent CÔTÉ SERVEUR
   (jamais exposés au navigateur). La fonction renvoie des sections-types et des
   conseils CANDIDATS (non versés) avec des scores de confiance et, si dérivable,
   la page source.

   Renvoie :
   - { source:"claude", sections, notes, warnings, confidence } en cas de succès ;
   - { source:"fallback", note } si l'IA n'est pas configurée / a échoué —
     l'appelant affiche « analyse IA non configurée » et ne verse rien.
   Ne LÈVE PAS sur un échec IA : la validation manuelle reste la garantie. */
export async function analyzeReferenceDocAI(text, { title = "", theme = "", filename = "" } = {}) {
  const clean = String(text || "").trim();
  if (!clean) return { source: "fallback", note: "empty_text" };

  let data;
  try {
    const res = await supabase.functions.invoke("analyze-reference-doc", {
      body: { text: clean, title, theme, filename },
    });
    if (res.error) return { source: "fallback", note: "invoke_error" };
    data = res.data;
  } catch {
    return { source: "fallback", note: "network" };
  }

  if (!data || data.source !== "claude") {
    return { source: "fallback", note: data?.note || "no_result" };
  }
  return {
    source: "claude",
    sections: Array.isArray(data.sections) ? data.sections : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    confidence: typeof data.confidence === "number" ? data.confidence : null,
  };
}
