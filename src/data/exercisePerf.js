import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { exKey } from "../lib/hevy.js";

/* Agrégats de performance par exercice (table exercise_perf, alimentée par le
   trigger de la migration 0080). Deux lectures :
   - la série personnelle du joueur (ses données) ;
   - la comparaison anonymisée moi / ma ligne / mon équipe, avec k-anonymat
     appliqué CÔTÉ SERVEUR (les moyennes ne sont renvoyées qu'à partir de 5
     joueurs distincts, et seulement pour sa propre équipe). Aucune valeur
     individuelle de coéquipier ne transite ici. */

// Série personnelle : [{ date, topKg, est1rm, volumeKg }], la plus ancienne d'abord.
export async function fetchExerciseSeries(exName) {
  const key = exKey(exName);
  if (!key) return [];
  const { data, error } = await supabase.rpc("player_exercise_series", { p_exercise_key: key });
  if (error) throw error;
  return (data || []).map((r) => ({
    date: r.d,
    topKg: r.top_kg != null ? Number(r.top_kg) : null,
    est1rm: r.est_1rm != null ? Number(r.est_1rm) : null,
    volumeKg: r.volume_kg != null ? Number(r.volume_kg) : null,
  }));
}

// Comparaison anonymisée. Renvoie { line, me, lineAgg, teamAgg } où lineAgg /
// teamAgg valent null tant que le seuil de k-anonymat n'est pas atteint.
export async function fetchExerciseAgg(exName) {
  const key = exKey(exName);
  if (!key) return { line: null, me: null, lineAgg: null, teamAgg: null };
  const { data, error } = await supabase.rpc("ex_agg", { p_exercise_key: key });
  if (error) throw error;
  const num = (x) => (x != null ? Number(x) : null);
  const grp = (g) => (g ? { n: g.n, top: num(g.top), orm: num(g.orm), vol: num(g.vol) } : null);
  return {
    line: data?.line || null,
    me: data?.me ? { top: num(data.me.top), orm: num(data.me.orm), vol: num(data.me.vol), sessions: data.me.sessions } : null,
    lineAgg: grp(data?.line_agg),
    teamAgg: grp(data?.team_agg),
  };
}

/* Hook combiné pour la vue joueur d'un exercice : série perso + comparaison
   anonymisée. `enabled` permet de ne charger qu'à l'ouverture de la modale. */
export function useExercisePerf(exName, enabled = true) {
  const [series, setSeries] = useState(null);
  const [agg, setAgg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !exName) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchExerciseSeries(exName), fetchExerciseAgg(exName)])
      .then(([s, a]) => { if (alive) { setSeries(s); setAgg(a); } })
      .catch((e) => { if (alive) setError(e.message || String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [exName, enabled]);

  return { series, agg, loading, error };
}
