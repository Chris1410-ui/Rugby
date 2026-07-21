import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Routines réutilisables (modèles de séances).
   - Routines d'ÉQUIPE (player_id NULL) : gérées par le staff/owner.
   - Routines PERSO du JOUEUR (player_id renseigné) : privées, séances libres
     réutilisables (Lot 4). Chaque hook filtre selon le propriétaire. */

function dbToRoutine(r) {
  return { id: r.id, name: r.name, templates: r.templates || [] };
}

export function useRoutines(teamId) {
  const [routines, setRoutines] = useState([]);

  const fetch = useCallback(async () => {
    if (!teamId) return;
    // Routines d'ÉQUIPE uniquement : on exclut les routines perso des joueurs.
    const { data, error } = await supabase
      .from("routines")
      .select("*")
      .eq("team_id", teamId)
      .is("player_id", null)
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

/* ── Routines PERSO du joueur (Lot 4) ── */

export function useMyRoutines(playerId) {
  const [routines, setRoutines] = useState([]);

  const fetch = useCallback(async () => {
    if (!playerId) return;
    const { data, error } = await supabase
      .from("routines")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[myRoutines]", error.message); return; }
    setRoutines((data ?? []).map(dbToRoutine));
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const channel = supabase
      .channel(`myRoutines:${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "routines", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playerId, fetch]);

  return { routines, refresh: fetch };
}

export async function saveMyRoutine(playerId, teamId, { name, templates }) {
  if (!playerId || !teamId) throw new Error("NO_TARGET");
  const { error } = await supabase
    .from("routines")
    .insert({ team_id: teamId, player_id: playerId, name: (name || "").trim() || "Ma routine", templates: templates || [] });
  if (error) throw error;
}

export async function deleteMyRoutine(id) {
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) throw error;
}
