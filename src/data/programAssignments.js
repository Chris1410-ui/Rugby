import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Couche données des ASSIGNATIONS de protocoles (table program_assignments,
   migration 0064). Une assignation cible tout le club, un groupe ou un joueur,
   avec des cibles individualisées ([{label,value}]) + un track optionnel.
   Écritures gardées par la RLS (owner / staff écrivain du club). */

export function dbToAssignment(r) {
  return {
    id: r.id,
    programId: r.program_id,
    teamId: r.team_id,
    scope: r.scope,
    groupKey: r.group_key || null,
    playerId: r.player_id || null,
    track: r.track || "",
    targets: Array.isArray(r.targets) ? r.targets : [],
    createdAt: r.created_at,
  };
}

// Toutes les assignations du club (realtime). Filtrées par programme côté écran.
export function useTeamProgramAssignments(teamId) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setAssignments([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("program_assignments")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });
    if (error) { console.error("[programAssignments]", error.message); setLoading(false); return; }
    setAssignments((data ?? []).map(dbToAssignment));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(`program_assignments:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "program_assignments", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { assignments, loading, refresh: fetch };
}

export async function addAssignment(teamId, programId, { scope, groupKey = null, playerId = null, track = "", targets = [] }) {
  const row = {
    team_id: teamId, program_id: programId, scope,
    group_key: scope === "group" ? groupKey : null,
    player_id: scope === "player" ? playerId : null,
    track: track.trim(), targets: cleanTargets(targets),
  };
  const { data, error } = await supabase.from("program_assignments").insert(row).select().single();
  if (error) throw error;
  return dbToAssignment(data);
}

export async function updateAssignment(id, { track, targets }) {
  const upd = {};
  if (track != null) upd.track = String(track).trim();
  if (targets != null) upd.targets = cleanTargets(targets);
  const { data, error } = await supabase.from("program_assignments").update(upd).eq("id", id).select().single();
  if (error) throw error;
  return dbToAssignment(data);
}

export async function deleteAssignment(id) {
  const { error } = await supabase.from("program_assignments").delete().eq("id", id);
  if (error) throw error;
}

// Normalise une liste de cibles : garde celles qui ont un libellé, trim.
export function cleanTargets(targets) {
  return (targets || [])
    .map((t) => ({ label: String(t.label ?? "").trim(), value: String(t.value ?? "").trim() }))
    .filter((t) => t.label !== "");
}
