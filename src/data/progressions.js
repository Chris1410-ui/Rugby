import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Familles de progression (chaînes d'exercices ordonnées, migration 0080/0084).
   Lecture publique (RLS select true). Pour un exercice donné, sa place dans la
   progression et l'étape suivante à viser. */

/* Renvoie, pour un exercice de la bibliothèque, sa progression :
   { family, position, total, current, next, steps[] } — ou null si l'exercice
   n'appartient à aucune famille. */
export async function getExerciseProgression(exerciseId) {
  if (!exerciseId) return null;
  const { data: hit, error } = await supabase
    .from("progression_steps")
    .select("family_id, position")
    .eq("exercise_id", exerciseId)
    .limit(1);
  if (error || !hit?.length) return null;
  const { family_id, position } = hit[0];

  const [{ data: fam }, { data: steps }] = await Promise.all([
    supabase.from("progression_families").select("*").eq("id", family_id).single(),
    supabase.from("progression_steps").select("*").eq("family_id", family_id).order("position", { ascending: true }),
  ]);
  const list = steps || [];
  return {
    family: fam || null,
    position,
    total: list.length,
    steps: list,
    current: list.find((s) => s.position === position) || null,
    next: list.find((s) => s.position === position + 1) || null,
  };
}

// Hook : charge la progression d'un exercice (par id), quand `enabled`.
export function useExerciseProgression(exerciseId, enabled = true) {
  const [progression, setProgression] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || !exerciseId) { setProgression(null); return; }
    let alive = true;
    setLoading(true);
    getExerciseProgression(exerciseId)
      .then((p) => { if (alive) setProgression(p); })
      .catch(() => { if (alive) setProgression(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [exerciseId, enabled]);
  return { progression, loading };
}
