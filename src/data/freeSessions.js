import { supabase } from "../lib/supabase.js";
import { isoDate, parseISO } from "../lib/metrics.js";

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

/* Import PDF (joueur) : développe les séances validées (weekday) sur `weeks`
   semaines à partir de `startDate` → lignes DATÉES { date, code, nature, titre,
   exercises }. Fonction PURE (testable). Première occurrence = premier jour ≥
   startDate correspondant au weekday, puis répétition hebdomadaire. */
export function expandProgramToRows(sessions, startISO, weeks) {
  const rows = [];
  const w = Math.max(1, Math.min(12, Number(weeks) || 4));
  const base = parseISO(startISO);
  if (!base || isNaN(base.getTime())) return rows;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  for (const s of sessions || []) {
    const exos = normalizeFreeExercises(s.exercises);
    if (!exos.length) continue;
    const wd = Number(s.weekday) || 0;
    const delta = (wd - start.getDay() + 7) % 7;
    const first = new Date(start); first.setDate(start.getDate() + delta);
    for (let k = 0; k < w; k++) {
      const d = new Date(first); d.setDate(first.getDate() + 7 * k);
      rows.push({ date: isoDate(d), code: s.code || "RS", nature: s.nature || "", titre: s.titre || "Séance importée", exercises: exos });
    }
  }
  return rows;
}

// Matérialise le programme importé pour le joueur connecté (séances datées).
export async function importProgramForSelf(sessions, { startDate, weeks } = {}) {
  const rows = expandProgramToRows(sessions, startDate, weeks);
  if (!rows.length) throw new Error("NO_ROWS");
  const { data, error } = await supabase.rpc("import_program_sessions", { p_rows: rows });
  if (error) throw error;
  return data; // nombre de séances créées
}
