/* Couche d'analyse — PR-4 : EFFICACITÉ PROTOCOLE.
   Pour chaque programme, mesure l'évolution du 1RM estimé (est_1rm) des exercices
   travaillés, du DÉBUT à la FIN du protocole, agrégée sur l'effectif. Répond à :
   « ce bloc a-t-il fait progresser la force ? »

   Honnêteté méthodo : c'est une évolution OBSERVÉE PENDANT le protocole
   (corrélationnel, pas causal — pas de groupe témoin). Gaté par la fiabilité :
   ≥ trendMinPoints mesures par joueur pour retenir sa progression, et le verdict
   collectif d'un exercice n'est exposé qu'à partir de kAnonMin joueurs (k-anon).
   NE MODIFIE aucune formule : lit exercise_perf (déjà cloisonné par club en RLS)
   et agrège AVANT affichage (aucune valeur nominative n'est exposée). */
import { RELIABILITY } from "./dataQuality.js";

export const EFFICACY = {
  minPoints: RELIABILITY.trendMinPoints, // ≥ 3 mesures/joueur/exercice → progression retenue
  minPlayers: RELIABILITY.kAnonMin,      // ≥ 5 joueurs → verdict collectif exposé
};

/* perf : lignes { sessionId, playerId, exerciseKey, exerciseName, est1rm, date }.
   sessions : { id, programId, date }. programs : { id, title, start, end }. */
export function programEfficacy({ programs = [], sessions = [], perf = [] } = {}) {
  const sessProg = new Map(sessions.map((s) => [s.id, s.programId || null]));
  const sessDate = new Map(sessions.map((s) => [s.id, s.date]));

  // programId → exerciseKey → { name, players: playerId → [{date, v}] }
  const byProg = new Map();
  for (const r of perf) {
    if (r.est1rm == null) continue;
    const progId = sessProg.get(r.sessionId);
    if (!progId) continue; // séance hors programme (autonome / test) → hors périmètre
    const date = r.date || sessDate.get(r.sessionId);
    if (!date) continue;
    if (!byProg.has(progId)) byProg.set(progId, new Map());
    const exMap = byProg.get(progId);
    if (!exMap.has(r.exerciseKey)) exMap.set(r.exerciseKey, { name: r.exerciseName || r.exerciseKey, players: new Map() });
    const ex = exMap.get(r.exerciseKey);
    if (!ex.players.has(r.playerId)) ex.players.set(r.playerId, []);
    ex.players.get(r.playerId).push({ date, v: Number(r.est1rm) });
  }

  const results = programs.map((prog) => {
    const exMap = byProg.get(prog.id) || new Map();
    const exercises = [];
    for (const [key, ex] of exMap) {
      const deltas = [];
      for (const pts of ex.players.values()) {
        if (pts.length < EFFICACY.minPoints) continue; // pas assez de mesures pour ce joueur
        const sorted = [...pts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        const first = sorted[0].v, last = sorted[sorted.length - 1].v;
        if (!(first > 0)) continue;
        deltas.push({ delta: last - first, pct: ((last - first) / first) * 100 });
      }
      const n = deltas.length;
      exercises.push({
        key, name: ex.name, nPlayers: n,
        meanDelta: n ? deltas.reduce((a, d) => a + d.delta, 0) / n : null,
        meanPct: n ? deltas.reduce((a, d) => a + d.pct, 0) / n : null,
        nImproved: deltas.filter((d) => d.delta > 0).length,
        reliable: n >= EFFICACY.minPlayers,
      });
    }
    exercises.sort((a, b) => b.nPlayers - a.nPlayers || String(a.name).localeCompare(String(b.name)));
    const reliableEx = exercises.filter((e) => e.reliable);
    return {
      program: prog,
      exercises,
      reliableCount: reliableEx.length,
      meanPct: reliableEx.length ? reliableEx.reduce((a, e) => a + e.meanPct, 0) / reliableEx.length : null,
    };
  });

  results.sort((a, b) => String(b.program.start || "").localeCompare(String(a.program.start || "")));
  return results;
}
