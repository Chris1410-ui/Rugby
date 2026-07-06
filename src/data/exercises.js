import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { exKey } from "../lib/exlib.js";

/* Bibliothèque d'exercices : catalogue global (team_id null) + perso d'équipe.
   RLS : lecture globale + équipe ; écriture perso réservée au staff. */

function dbToExercise(r) {
  return { id: r.id, name: r.name, cat: r.category, q: r.quality, cues: r.cues, custom: r.is_custom, teamId: r.team_id };
}

export function useExercises(teamId) {
  const [exercises, setExercises] = useState([]);

  const fetch = useCallback(async () => {
    // global (team_id null) OU équipe courante
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .or(`team_id.is.null,team_id.eq.${teamId}`)
      .order("name", { ascending: true });
    if (error) { console.error("[exercises]", error.message); return; }
    setExercises((data ?? []).map(dbToExercise));
  }, [teamId]);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel(`exercises:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exercises" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  const find = useCallback((name) => exercises.find((e) => exKey(e.name) === exKey(name)), [exercises]);
  return { exercises, find, refresh: fetch };
}

export async function addCustomExercise(teamId, { name, cat, cues }) {
  const { error } = await supabase
    .from("exercises")
    .insert({ team_id: teamId, name: name.trim(), category: cat, quality: "Personnalisé", cues: cues?.trim() || "—", is_custom: true });
  if (error) throw error;
}
