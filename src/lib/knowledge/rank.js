/* Classement des conseils (knowledge_notes publiés) par pertinence vis-à-vis du
   protocole en cours d'édition. Pur et déterministe (aucun LLM, aucun réseau) —
   testable. Le contexte = { theme, terms } dérivé de la catégorie, la nature, le
   titre et les titres de sections du protocole. */
import { norm } from "../catalog/detect.js";

// Texte normalisé indexable d'un conseil (thème + titre + corps + tags).
export function noteHaystack(note) {
  return norm([note?.theme, note?.title, note?.body, (note?.tags || []).join(" ")].filter(Boolean).join(" "));
}

// Extrait des termes de recherche (≥ 3 lettres, dédupliqués) d'un texte libre.
export function contextTerms(...parts) {
  const words = norm(parts.filter(Boolean).join(" ")).split(" ");
  return [...new Set(words.filter((w) => w.length >= 3))];
}

/* Note chaque conseil : +100 thème exact, +20 thème mentionné, +10 par terme de
   contexte présent. Tri par score puis confiance. Renvoie les conseils enrichis
   d'un `_score` (0 = aucun rapprochement). */
export function rankNotes(notes, { theme = "", terms = [] } = {}) {
  const nTheme = norm(theme);
  const nTerms = [...new Set((terms || []).map(norm).filter((x) => x.length >= 3))];
  return (notes || [])
    .map((note) => {
      const hay = noteHaystack(note);
      let score = 0;
      const noteTheme = norm(note?.theme);
      if (nTheme && noteTheme && noteTheme === nTheme) score += 100;
      else if (nTheme && noteTheme && hay.includes(nTheme)) score += 20;
      for (const term of nTerms) if (term && hay.includes(term)) score += 10;
      return { note, score };
    })
    .sort((a, b) => b.score - a.score || (b.note?.confidence || 0) - (a.note?.confidence || 0))
    .map((x) => ({ ...x.note, _score: x.score }));
}
