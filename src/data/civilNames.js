import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Noms civils des joueurs (migration 0127) — table SÉPARÉE, strictement réservée
   au staff/owner du club (RLS). Jamais exposée aux joueurs. Utilisée UNIQUEMENT
   par l'écran « Wellness » staff. Partout ailleurs : totem + initiales. */

// Map { [playerId]: civilName } pour l'équipe. Vide si l'appelant n'est pas
// autorisé (RLS → aucune ligne) : l'écran retombe alors sur le totem.
export function useCivilNames(teamId) {
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setNames({}); setLoading(false); return; }
    const { data, error } = await supabase
      .from("player_civil_names")
      .select("player_id, civil_name")
      .eq("team_id", teamId);
    if (error) { setNames({}); setLoading(false); return; }
    setNames(Object.fromEntries((data ?? []).map((r) => [r.player_id, r.civil_name])));
    setLoading(false);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { names, loading, refresh: fetch };
}

// Import par totem. rows = [{ totem, name }]. teamId = club affiché (utilisé
// pour l'owner, dont profiles.team_id peut être null). Renvoie { matched, unmatched }.
export async function importCivilNames(rows, teamId) {
  const { data, error } = await supabase.rpc("import_civil_names", { p_rows: rows, p_team_id: teamId || null });
  if (error) throw error;
  return { matched: data?.matched ?? [], unmatched: data?.unmatched ?? [] };
}

// Droit à l'effacement (owner) : supprime TOUS les noms civils du club.
export async function clearCivilNames(teamId) {
  const { data, error } = await supabase.rpc("clear_civil_names", { p_team_id: teamId || null });
  if (error) throw error;
  return data; // nombre supprimé
}
