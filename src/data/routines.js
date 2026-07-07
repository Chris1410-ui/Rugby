import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Routines réutilisables (modèles de séances). RLS : staff de l'équipe. */

function dbToRoutine(r) {
  return { id: r.id, name: r.name, templates: r.templates || [] };
}

export function useRoutines(teamId) {
  const [routines, setRoutines] = useState([]);

  const fetch = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("routines")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[routines]", error.message); return; }
    setRoutines((data ?? []).map(dbToRoutine));
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(`routines:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "routines", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { routines, refresh: fetch };
}

export async function saveRoutine(teamId, { name, templates }) {
  const { error } = await supabase.from("routines").insert({ team_id: teamId, name: name.trim(), templates });
  if (error) throw error;
}

export async function deleteRoutine(id) {
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) throw error;
}
