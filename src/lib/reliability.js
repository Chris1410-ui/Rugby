/* Fiabilité des indicateurs — TRANSPARENCE « estimé » vs « réel ».

   PUR et ADDITIF : ne modifie AUCUNE formule (computeReadiness, playerLoad,
   wbToWellness, enrichPlayers restent la source de vérité). On lit seulement les
   sorties DÉJÀ calculées :
   - `_live`  : posé par enrichPlayers → un bilan du matin réel existe pour la
                période (sinon readiness repose sur le seed → à masquer « — »).
   - `_load.hist[].real` : posé par loadDaily → jour réellement loggé (séance
                done+RPE ou missed). Sert à juger si l'ACWR est « réel » ou seed. */

// Seuils ACWR : nb de séances réellement loggées pour considérer l'ACWR « réel ».
export const ACWR_MIN_LOGS_28 = 6; // sur les 28 derniers jours
export const ACWR_MIN_LOGS_7 = 1;  // dont au moins 1 sur la semaine aiguë (7 j)

/* Readiness « réel » = un bilan du matin a été saisi (flag _live). Sinon le
   score affiché viendrait du seed (bien-être par défaut) → on affiche « — ». */
export const readinessReady = (p) => !!(p && p._live);

// Compte les jours réellement loggés sur les N derniers jours de l'historique
// de charge (real:true = séance validée avec RPE, ou manquée).
function realLogs(p, days) {
  const hist = Array.isArray(p?._load?.hist) ? p._load.hist : [];
  return hist.slice(-days).filter((o) => o && o.real).length;
}

/* ACWR « réel » si assez de séances loggées couvrent la fenêtre : ≥ 6 sur 28 j
   ET ≥ 1 sur les 7 derniers jours (sans quoi le numérateur aigu reste du seed).
   Défaut prudent : sans historique de charge → estimé. */
export function acwrReliable(p) {
  return realLogs(p, 28) >= ACWR_MIN_LOGS_28 && realLogs(p, 7) >= ACWR_MIN_LOGS_7;
}
export const acwrEstimated = (p) => !acwrReliable(p);
