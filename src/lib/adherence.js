/* Couche d'analyse — PR-2 : RESPECT DU PRESCRIT (prescrit vs réalisé).
   Mesure, par joueur et pour l'équipe, la part des séances PRESCRITES (staff) qui
   ont été effectivement RÉALISÉES sur une fenêtre, plus la qualité d'exécution
   (séries prescrites vs réalisées sur les séances faites).

   NE MODIFIE aucune formule existante (playerLoad, sRPE, computeReadiness…) : on
   lit leurs entrées (sessions prescrites + logs) pour mesurer l'adhérence, une
   couche AU-DESSUS. Purement fonctionnel/testable, borné à l'effectif fourni
   (déjà cloisonné par club via la RLS). Réutilise les seuils de PR-1
   (RELIABILITY) et le comparatif prescrit/réalisé exercice de exercisePerf. */
import { todayISO, isoDate, parseISO } from "./metrics.js";
import { RELIABILITY } from "./dataQuality.js";
import { perfRowsFromLog } from "./exercisePerf.js";

// Séances « prescrites » = décidées par le staff (exclut le libre/autonome joueur).
const PRESCRIBED_ORIGINS = new Set(["staff", "plan"]);

export const ADHERENCE = {
  lowRate: 0.7, // sous 70 % de séances réalisées → à surveiller
};

const daysAgoISO = (today, days) => isoDate(new Date(parseISO(today).getTime() - days * 864e5));

/* Adhérence d'UN joueur sur la fenêtre. Ne compte que les séances prescrites
   ÉCHUES (date ≤ aujourd'hui) qui lui sont assignées :
   - done    : loggée « faite » ;
   - missed  : marquée « manquée » ;
   - skipped : échue mais ni faite ni marquée (oubli de saisie / non faite).
   `rate` = done / prescribed (null si aucune séance). `reliable` = assez de
   séances prescrites pour un taux exploitable (min = loadMinSessions de PR-1).
   Adhérence exercices : sur les séances faites, part des exercices dont les
   séries réalisées ≥ prescrites (miroir de exercise_perf.adhered). */
export function playerAdherence(player, sessions, logs, today = todayISO(), win = RELIABILITY.loadWindowDays) {
  const from = daysAgoISO(today, win);
  let prescribed = 0, done = 0, missed = 0, skipped = 0;
  let exPresc = 0, exAdhered = 0;
  for (const s of sessions || []) {
    if (!PRESCRIBED_ORIGINS.has(s.origin || "staff")) continue;
    if (!s.assignedIds?.includes(player.id)) continue;
    if (!s.date || s.date < from || s.date > today) continue; // fenêtre + échue
    prescribed++;
    const lg = logs?.[s.id]?.[player.id];
    const st = lg?.status || "pending";
    if (st === "done") {
      done++;
      perfRowsFromLog(lg.perExercise || {}, s.exercises || []).forEach((r) => {
        exPresc++;
        if (r.adhered) exAdhered++;
      });
    } else if (st === "missed") {
      missed++;
    } else {
      skipped++;
    }
  }
  return {
    prescribed, done, missed, skipped,
    rate: prescribed ? done / prescribed : null,
    exercisePresc: exPresc, exerciseAdhered: exAdhered,
    exerciseRate: exPresc ? exAdhered / exPresc : null,
    reliable: prescribed >= RELIABILITY.loadMinSessions,
    window: win, min: RELIABILITY.loadMinSessions,
  };
}

/* Adhérence d'ÉQUIPE. Lignes par joueur (les plus faibles en tête ; « données
   insuffisantes » en bas). Le taux d'équipe agrège les joueurs FIABLES (évite le
   biais des petits effectifs de séances) et n'est exposé qu'au-delà du seuil de
   k-anonymat (agrégat collectif masqué sous kAnonMin joueurs fiables) ; les
   lignes individuelles restent visibles côté staff. `belowIds` = joueurs fiables
   sous le seuil d'adhérence. */
export function teamAdherence({ players = [], sessions = [], logs = {}, today = todayISO(), win = RELIABILITY.loadWindowDays } = {}) {
  const rows = players.map((p) => ({ id: p.id, player: p, ...playerAdherence(p, sessions, logs, today, win) }));
  const reliableRows = rows.filter((r) => r.reliable);
  const totDone = reliableRows.reduce((a, r) => a + r.done, 0);
  const totPresc = reliableRows.reduce((a, r) => a + r.prescribed, 0);
  const sorted = [...rows].sort((a, b) => (a.rate == null ? 2 : a.rate) - (b.rate == null ? 2 : b.rate));
  return {
    rows: sorted,
    team: { rate: totPresc ? totDone / totPresc : null, nReliable: reliableRows.length, done: totDone, prescribed: totPresc },
    kAnon: reliableRows.length >= RELIABILITY.kAnonMin,
    belowIds: reliableRows.filter((r) => r.rate != null && r.rate < ADHERENCE.lowRate).map((r) => r.id),
    lowRate: ADHERENCE.lowRate, window: win,
  };
}
