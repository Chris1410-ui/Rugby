/* Couche d'analyse — PR-1 : FIABILITÉ des données + BOUCLE DE SAISIE.
   Pur & testable (aucun réseau). NE MODIFIE aucune formule existante
   (playerLoad, computeReadiness, points…) : on lit leurs entrées pour mesurer
   la QUALITÉ de saisie et gater les conclusions. Tout est borné à l'effectif
   fourni (déjà cloisonné par club en amont via la RLS). */
import { todayISO, isoDate, parseISO } from "./metrics.js";

// Seuils de fiabilité (confirmés) — centralisés pour un usage cohérent partout.
export const RELIABILITY = {
  loadWindowDays: 28,   // fenêtre d'analyse de charge
  loadMinSessions: 6,   // ≥ 6 séances loggées / 28 j pour une charge fiable
  trendMinPoints: 3,    // ≥ 3 mesures pour dégager une tendance
  kAnonMin: 5,          // agrégat collectif masqué sous 5 joueurs
  bilanRecentDays: 7,   // « bilan récent » = dans les 7 derniers jours
};

function daysAgoISO(today, days) {
  const d = parseISO(today) || new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - days));
}

/* Fiabilité de la charge d'UN joueur = nombre de séances RÉELLEMENT loggées
   (statut « done ») sur la fenêtre. En dessous du seuil, l'ACWR/charge repose
   surtout sur l'estimation seed → à signaler, jamais à présenter comme un fait. */
export function loadReliability(player, sessions, logs, today = todayISO(), win = RELIABILITY.loadWindowDays) {
  const from = daysAgoISO(today, win);
  let n = 0;
  for (const s of sessions || []) {
    if (!(s.assignedIds || []).includes(player?.id)) continue;
    if (s.date > today || s.date < from) continue;
    if (logs?.[s.id]?.[player.id]?.status === "done") n++;
  }
  return { n, reliable: n >= RELIABILITY.loadMinSessions, window: win, min: RELIABILITY.loadMinSessions };
}

/* Déficits de saisie du club : rend VISIBLE ce qui manque pour fiabiliser
   l'analyse. Retourne, par déficit, la liste des joueurs concernés (+ compte).
   - noDuration : a des séances réalisées mais AUCUNE durée réelle saisie ;
   - no1RM      : aucun 1RM courant renseigné ;
   - noBilan    : aucun bilan dans les 7 derniers jours ;
   - lowLog     : charge non fiable (< seuil de séances loggées / fenêtre). */
export function teamDataCompleteness({ players = [], sessions = [], logs = {}, oneRM = [], bilans = {}, today = todayISO() } = {}) {
  const has1RM = new Set((oneRM || []).filter((e) => e.valueKg != null).map((e) => e.playerId));
  const bilanFrom = daysAgoISO(today, RELIABILITY.bilanRecentDays);
  const noDuration = [], no1RM = [], noBilan = [], lowLog = [];

  for (const p of players) {
    let done = 0, withDur = 0;
    for (const s of sessions) {
      if (!(s.assignedIds || []).includes(p.id) || s.date > today) continue;
      const lg = logs?.[s.id]?.[p.id];
      if (lg?.status === "done") { done++; if (lg.duration > 0) withDur++; }
    }
    if (done > 0 && withDur === 0) noDuration.push(p.id);
    if (!has1RM.has(p.id)) no1RM.push(p.id);
    if (!(bilans?.[p.id] || []).some((b) => b.date >= bilanFrom && b.date <= today)) noBilan.push(p.id);
    if (loadReliability(p, sessions, logs, today).n < RELIABILITY.loadMinSessions) lowLog.push(p.id);
  }

  const wrap = (ids) => ({ ids, n: ids.length });
  return {
    total: players.length,
    noDuration: wrap(noDuration),
    no1RM: wrap(no1RM),
    noBilan: wrap(noBilan),
    lowLog: wrap(lowLog),
  };
}
