import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Séances (sessions). En attendant les programmes complets (étape 7), les séances
   sont des lignes datées directes. `assigned` (jsonb) définit les destinataires. */

// Résout la liste des joueurs assignés à partir de `assigned` + effectif
export function resolveAssignedIds(assigned, roster) {
  if (!assigned || assigned.mode === "all" || !assigned.mode) return roster.map((p) => p.id);
  if (assigned.mode === "group") return roster.filter((p) => p.grp === assigned.group).map((p) => p.id);
  return assigned.ids || [];
}

// Ligne DB → forme attendue par les écrans + le moteur (assignedIds, dur, exercises[])
export function dbToSession(row, roster) {
  return {
    id: row.id,
    date: row.date,
    code: row.code || "RS",
    titre: row.titre || "Séance",
    progTitle: row.titre || "Séance",
    dur: row.duration_min || 60,
    exercises: Array.isArray(row.exercises) ? row.exercises : [],
    assigned: row.assigned || { mode: "all" },
    assignedIds: resolveAssignedIds(row.assigned, roster),
  };
}

export function useTeamSessions(teamId, roster) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("team_id", teamId)
      .order("date", { ascending: true });
    if (error) { console.error("[sessions]", error.message); setLoading(false); return; }
    setRows(data ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(`sessions:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  // On mappe avec l'effectif courant (assignedIds dépend du roster)
  const sessions = rows.map((r) => dbToSession(r, roster || []));
  return { sessions, loading, refresh: fetch };
}

// Création d'une séance par le staff (précurseur minimal des programmes, étape 7)
export async function createSession(teamId, { date, code, titre, durationMin, exercises, assigned }) {
  const uid = () => (globalThis.crypto?.randomUUID?.() || `e${Math.random().toString(36).slice(2, 10)}`);
  const withIds = (exercises || []).map((e) => ({
    id: e.id || uid(),
    name: e.name,
    sets: e.sets ?? 3,
    reps: e.reps ?? "8",
    charge: e.charge ?? "",
    rest: e.rest ?? 90,
  }));
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      date,
      code: code || "RS",
      titre: titre || "Séance",
      duration_min: durationMin || 60,
      exercises: withIds,
      assigned: assigned || { mode: "all" },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
