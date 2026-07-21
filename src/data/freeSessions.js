import { supabase } from "../lib/supabase.js";

/* Séances libres (autonomes) créées par le joueur — cf. migration 0054.
   Le joueur n'écrit pas sur `sessions` directement : passage par des fonctions
   SECURITY DEFINER. La séance créée est datée du jour, assignée au joueur seul,
   et se loggue ensuite avec le moteur habituel (SessionPlayCard → session_logs). */

const uid = () => (globalThis.crypto?.randomUUID?.() || `e${Math.random().toString(36).slice(2, 10)}`);

// Normalise les exercices du panier vers la forme attendue par le moteur de log
// (mêmes champs que createSession : id/name/sets/reps/charge/rest).
export function normalizeFreeExercises(items) {
  return (items || [])
    .filter((e) => e && e.name && String(e.name).trim())
    .map((e) => ({
      id: e.id || uid(),
      name: String(e.name).trim(),
      sets: Number(e.sets) > 0 ? Number(e.sets) : 3,
      reps: e.reps != null && String(e.reps).trim() ? String(e.reps).trim() : "8",
      charge: e.charge != null ? String(e.charge).trim() : "",
      rest: Number(e.rest) > 0 ? Number(e.rest) : 90,
      ref: e.ref || null, // trace vers la Bibliothèque (facultatif)
    }));
}

export async function createFreeSession({ title, code, durationMin, exercises }) {
  const rows = normalizeFreeExercises(exercises);
  if (rows.length === 0) throw new Error("NO_EXERCISE");
  const { data, error } = await supabase.rpc("create_free_session", {
    p_title: (title || "").trim() || null,
    p_code: code || "RS",
    p_duration: Number(durationMin) > 0 ? Number(durationMin) : 60,
    p_exercises: rows,
  });
  if (error) throw error;
  return data; // id de la séance créée
}

export async function deleteFreeSession(sessionId) {
  const { error } = await supabase.rpc("delete_free_session", { p_session: sessionId });
  if (error) throw error;
}
