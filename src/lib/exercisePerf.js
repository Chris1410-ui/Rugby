/* Agrégats de performance par exercice — miroir JS pur de la logique SQL du
   trigger `_rebuild_exercise_perf` (migration 0080). Sert de source unique aux
   vues joueur/staff (PR3/PR4) pour recomposer localement un agrégat à partir
   d'un log, et de contrat testable garantissant que client et serveur calculent
   la MÊME chose.

   Réutilise les formules existantes sans les modifier : e1RM (Epley) et exKey
   (normalisation anti-doublon) de lib/hevy.js.

   ⚠️ Différence assumée avec hevy.js `workingSets` : on NE filtre PAS sur
   `set.done`. Ce drapeau set-par-set est en pratique presque toujours `false`
   dans les logs réels (le joueur valide la séance, pas chaque série). On
   considère donc une série comme réalisée dès qu'une charge OU des reps sont
   saisies ; l'échauffement (`type === 'warmup'`) reste exclu des agrégats. */
import { e1RM, exKey } from "./hevy.js";

// Valeur numérique de tête d'une saisie libre : "10 kg" → 10, "30 s" → 30,
// "12 " → 12, "10kg " → 10, "" → null. La virgule décimale est acceptée.
export function numLead(txt) {
  const m = String(txt ?? "").match(/[0-9]+(?:[.,][0-9]+)?/);
  return m ? Number(m[0].replace(",", ".")) : null;
}

// % de 1RM éventuellement écrit dans une cellule de prescription ("@70%",
// "70%@", "70 %") → 70, sinon null. Best-effort, tolérant à l'ordre.
export function prescPct(txt) {
  const m = String(txt ?? "").match(/([0-9]+)\s*%/);
  return m ? Number(m[1]) : null;
}

/* Agrège les séries réalisées d'UN exercice (le `per_exercise[exoId]` d'un log).
   Retourne top charge, volume (Σ w·reps), 1RM estimé (meilleur Epley) et nombre
   de séries réalisées. Les séries d'échauffement sont ignorées. */
export function perfFromSets(perExo) {
  const sets = Array.isArray(perExo?.sets) ? perExo.sets : [];
  let topKg = null;
  let volumeKg = null;
  let est1rm = 0;
  let doneSets = 0;
  for (const st of sets) {
    if ((st?.type || "normal") === "warmup") continue;
    const w = numLead(st?.w);
    const r = numLead(st?.reps);
    if (w == null && r == null) continue; // série non renseignée
    doneSets += 1;
    if (w != null) topKg = Math.max(topKg ?? 0, w);
    if (w != null && r != null) volumeKg = (volumeKg ?? 0) + w * r;
    est1rm = Math.max(est1rm, e1RM(w || 0, r || 0));
  }
  return { topKg, volumeKg, est1rm, doneSets };
}

// Adhérence : prescription absente (bodyweight/libre) OU séries réalisées ≥
// séries prescrites. Miroir exact de la colonne `adhered` côté SQL.
export function adhered(doneSets, prescSets) {
  return prescSets == null || doneSets >= prescSets;
}

/* Recompose l'agrégat complet d'un log (par exercice), en rattachant chaque
   entrée `per_exercise` au descriptif de séance (`sessions.exercises`) pour le
   nom, les séries et le % prescrits. Retourne un tableau d'objets alignés sur
   les colonnes de `exercise_perf`. Ne matérialise que les exercices travaillés
   (doneSets > 0), exactement comme le trigger. */
export function perfRowsFromLog(perExercise, sessionExercises = []) {
  const byId = new Map((sessionExercises || []).map((e) => [String(e?.id), e]));
  const rows = [];
  for (const [exoId, perExo] of Object.entries(perExercise || {})) {
    const agg = perfFromSets(perExo);
    if (agg.doneSets <= 0) continue;
    const desc = byId.get(String(exoId)) || {};
    const name = desc.name || "";
    const prescSets = numLead(desc.sets);
    const pct = prescPct(`${desc.reps ?? ""} ${desc.charge ?? ""}`);
    rows.push({
      exerciseKey: exKey(name),
      exerciseName: name,
      topKg: agg.topKg,
      volumeKg: agg.volumeKg,
      est1rm: agg.est1rm,
      prescSets: prescSets == null ? null : Math.round(prescSets),
      doneSets: agg.doneSets,
      prescPct: pct,
      adhered: adhered(agg.doneSets, prescSets),
    });
  }
  return rows;
}
