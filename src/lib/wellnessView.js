/* Vue « wellness » côté STAFF — convention d'affichage « plus haut = meilleur »
   (vert = favorable), calquée sur le questionnaire club.

   IMPORTANT : purement cosmétique. N'altère NI la saisie du joueur, NI les
   formules (readiness/points/wbToWellness), NI les données stockées. Tout est
   recalculé à la volée depuis l'objet `wb` d'un bilan du matin. Dans l'app, les
   marqueurs « fatigue » et « stress » montent = c'est PIRE ; ici on les inverse
   pour l'affichage uniquement, afin que tout aille dans le même sens. */

const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

// Inverse un marqueur 1..10 (haut = pire → haut = mieux). Null-safe.
export const reverse10 = (v) => (num(v) == null ? null : 11 - v);

/* Marqueurs ramenés en « favorable » (1..10, plus haut = mieux). */
export function favMarkers(wb = {}) {
  return {
    sommeil: num(wb.sleep),
    fatigue: reverse10(wb.fatigue), // app : haut = + fatigué → favorable = énergie
    stress: reverse10(wb.stress),   // app : haut = + stressé → favorable = calme
    humeur: num(wb.mood),
    wellness: num(wb.genWell),      // question directe « bien-être général »
    willTrain: num(wb.willTrain),
  };
}

// RPE de la veille : brut (haut = + d'effort → à surveiller, pas « favorable »).
export const rpeOf = (wb = {}) => num(wb.rpePrev);

// Remarque libre du matin (chaîne non vide) ou null.
export const remarkOf = (wb = {}) =>
  typeof wb.remark === "string" && wb.remark.trim() ? wb.remark.trim() : null;

export const mean = (arr) => {
  const a = (arr || []).filter((x) => num(x) != null);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
};

/* Indice de récupération = moyenne favorable de sommeil, fatigue, stress, humeur
   (1..10). Null si aucun des quatre n'est renseigné. */
export function recoveryIndex(wb) {
  const f = favMarkers(wb);
  return mean([f.sommeil, f.fatigue, f.stress, f.humeur]);
}

// Bien-être général (question directe) ; null si absent (anciens bilans).
export const wellnessScore = (wb) => favMarkers(wb).wellness;

/* Statut /10, calqué sur le mockup (/5 ×2) : OK ≥ 7 · Vigilance 5–6.99 ·
   Alerte < 5. Renvoie null si l'indice n'est pas calculable. */
export function statusOf(recovery) {
  if (num(recovery) == null) return null;
  if (recovery >= 7) return "ok";
  if (recovery >= 5) return "vigilance";
  return "alerte";
}

// À surveiller : récupération < 7 (vigilance/alerte) OU présence d'une remarque.
export function needsWatch(wb) {
  const rec = recoveryIndex(wb);
  return remarkOf(wb) != null || (num(rec) != null && rec < 7);
}
