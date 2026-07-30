/* Avancement RÉEL d'une séance (séries faites / total) — dérivé du log persisté.
   Miroir EXACT de la logique de comptage de SessionPlayCard (mêmes kinds, même
   repli d'id `x{i}`, même définition « done ») pour que le compteur X/Y de la
   carte « Séance du jour » colle au lecteur set-par-set. Fonction PURE : aucune
   dépendance réseau, aucun 1RM requis (le total de séries n'en dépend pas). */
import { exerciseInputModel } from "./sessionType.js";
import { effectiveNature } from "./nature.js";
import { prescribedRepsPlan } from "./hevy.js";

// Blocs « mono » : une seule unité cochable (fait / pas fait).
const MONO_KINDS = new Set(["conditioning", "vitesse", "mobility", "cardio_continuous", "cardio_circuit", "cardio_test"]);

// Nombre de séries prévues d'un exercice set-like (hors log) : setPlan explicite,
// sinon plan de reps prescrit (« 5-10-15 » → 3), sinon e.sets.
function plannedSetCount(e) {
  if (Array.isArray(e?.setPlan) && e.setPlan.length) return e.setPlan.length;
  return prescribedRepsPlan(e?.reps, e?.sets).count || 1;
}

/* → { done, total } séries pour une séance donnée + son log (peut être null).
   - set-like (strength/bodyweight/skill) : total = séries du log si présent,
     sinon séries prévues ; done = séries cochées du log.
   - cardio_interval : total = répétitions (repPlan|reps|4) ; done = reps cochées.
   - mono (conditioning/vitesse/mobility/cardio_*) : total 1 ; done = 1 si fait. */
export function sessionProgress(s, log) {
  const effNature = effectiveNature(s?.nature, s?.code);
  const exos = (Array.isArray(s?.exercises) ? s.exercises : []).map((e, i) => (e && e.id ? e : { ...e, id: `x${i}` }));
  let done = 0, total = 0;
  for (const e of exos) {
    const k = exerciseInputModel(e, effNature);
    const saved = log?.perExercise?.[e.id];
    if (k === "cardio_interval") {
      const n = Array.isArray(e.repPlan) && e.repPlan.length ? e.repPlan.length : (Number(e.reps) > 0 ? Number(e.reps) : 4);
      total += n;
      if (saved && Array.isArray(saved.reps)) done += saved.reps.filter((x) => x && x.done).length;
    } else if (MONO_KINDS.has(k)) {
      total += 1;
      if (saved && saved.done) done += 1;
    } else {
      // set-like
      const nSets = Array.isArray(saved?.sets) ? saved.sets.length : plannedSetCount(e);
      total += nSets;
      if (Array.isArray(saved?.sets)) done += saved.sets.filter((x) => x && x.done).length;
    }
  }
  return { done, total };
}
