import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { resolveAssignedIds } from "./sessions.js";
import { uniqueTopic } from "./messages.js";

/* Tâches assignées aux joueurs + validation en 2 temps (joueur « Fait » →
   coach « Valider »). Le joueur n'écrit jamais en direct : task_mark_done /
   task_unmark sont des RPC SECURITY DEFINER (cf. migration 0024). Le staff
   confirme/refuse en écriture directe (RLS staff). */

export function dbToTask(row, roster) {
  return {
    id: row.id,
    teamId: row.team_id,
    titre: row.titre,
    description: row.description || "",
    lieu: row.lieu || "",
    echeance: row.echeance || null,
    assigned: row.assigned || { mode: "all" },
    assignedIds: resolveAssignedIds(row.assigned, roster || []),
    createdAt: row.created_at,
  };
}

const dbToCompletion = (r) => ({ taskId: r.task_id, playerId: r.player_id, statut: r.statut, validatedAt: r.validated_at, confirmedAt: r.confirmed_at });

// Tâches du club (lecture team). `roster` sert à résoudre assignedIds.
export function useTeamTasks(teamId, roster) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("tasks").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) { console.error("[tasks]", error.message); setLoading(false); return; }
    setRows(data ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`tasks:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  const tasks = rows.map((r) => dbToTask(r, roster || []));
  return { tasks, loading, refresh: fetch };
}

/* Toutes les complétions du club (staff) → { [taskId]: { [playerId]: completion } }.
   RLS : staff = équipe. Realtime. */
export function useTeamTaskCompletions(teamId) {
  const [byTask, setByTask] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByTask({}); return; }
    const { data, error } = await supabase
      .from("task_completions").select("*").eq("team_id", teamId);
    if (error) { console.error("[task completions]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.task_id] = m[r.task_id] || {})[r.player_id] = dbToCompletion(r); });
    setByTask(m);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`taskcomp:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_completions", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { byTask, refresh: fetch };
}

/* Complétions du joueur connecté → { [taskId]: statut }. RLS : les siennes. */
export function useMyTaskCompletions(playerId) {
  const [byTask, setByTask] = useState({});

  const fetch = useCallback(async () => {
    if (!playerId) { setByTask({}); return; }
    const { data, error } = await supabase
      .from("task_completions").select("task_id, statut").eq("player_id", playerId);
    if (error) { console.error("[my task completions]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { m[r.task_id] = r.statut; });
    setByTask(m);
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase
      .channel(uniqueTopic(`mytasks:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_completions", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  return { statutByTask: byTask, refresh: fetch };
}

/* Tâches validées par joueur du club (SECURITY DEFINER) → { [playerId]: [{ titre, date }] }.
   Alimente le +2 au classement (visible par tous). Owner : p_team ciblé. */
export function useTeamTaskPoints(teamId) {
  const [byPlayer, setByPlayer] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_task_points", { p_team: teamId });
    if (error) { console.error("[team_task_points]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ titre: r.titre, date: r.at }); });
    setByPlayer(m);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`taskpts:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_completions" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return byPlayer;
}

// ── Écritures ──
export async function createTask(teamId, { titre, description, lieu, echeance, assigned }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ team_id: teamId, titre: titre.trim(), description: description?.trim() || null, lieu: lieu?.trim() || null, echeance: echeance || null, assigned: assigned || { mode: "all" }, created_by: auth?.user?.id })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, patch) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id); // cascade completions
  if (error) throw error;
}

// Joueur (via RPC) : marque / annule « Fait ».
export async function markTaskDone(taskId) {
  const { error } = await supabase.rpc("task_mark_done", { p_task: taskId });
  if (error) throw error;
}
export async function unmarkTask(taskId) {
  const { error } = await supabase.rpc("task_unmark", { p_task: taskId });
  if (error) throw error;
}

// Coach (écriture directe RLS staff) : confirme / refuse.
export async function confirmTask(taskId, playerId, teamId) {
  const { error } = await supabase
    .from("task_completions")
    .upsert({ task_id: taskId, player_id: playerId, team_id: teamId, statut: "confirmee", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "task_id,player_id" });
  if (error) throw error;
}
export async function refuseTask(taskId, playerId) {
  const { error } = await supabase
    .from("task_completions")
    .update({ statut: "a_faire", validated_at: null, confirmed_at: null, updated_at: new Date().toISOString() })
    .eq("task_id", taskId).eq("player_id", playerId);
  if (error) throw error;
}
