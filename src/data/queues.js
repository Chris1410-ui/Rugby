import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Ordre de passage (migration 0100). Le staff gère la file (RLS staff/owner) ;
   le joueur lit et s'auto-inscrit via la RPC queue_join (jamais d'écriture
   directe). Temps réel sur queues + queue_tickets. */

function dbToQueue(r) {
  return {
    id: r.id, teamId: r.team_id, title: r.title, lieu: r.lieu || "",
    scheduledAt: r.scheduled_at || null, status: r.status || "open",
    currentFocus: r.current_focus || "", createdBy: r.created_by || null,
    createdAt: r.created_at, closedAt: r.closed_at || null,
  };
}
function dbToTicket(r) {
  return {
    id: r.id, queueId: r.queue_id, teamId: r.team_id, playerId: r.player_id,
    position: r.position ?? 0, progress: r.progress ?? 0, absent: !!r.absent,
    joinedAt: r.joined_at, startedAt: r.started_at || null, doneAt: r.done_at || null,
  };
}

// Files du club (staff : toutes ; joueur : ouvertes + celles où il a un ticket).
export function useQueues(teamId) {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setQueues([]); setLoading(false); return; }
    const { data, error } = await supabase.from("queues").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) { console.error("[queues]", error.message); setLoading(false); return; }
    setQueues((data ?? []).map(dbToQueue));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`queues:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "queues", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { queues, loading, refresh: fetch };
}

// Tickets d'une file (ordre = position), temps réel.
export function useQueueTickets(queueId) {
  const [tickets, setTickets] = useState([]);

  const fetch = useCallback(async () => {
    if (!queueId) { setTickets([]); return; }
    const { data, error } = await supabase.from("queue_tickets").select("*").eq("queue_id", queueId)
      .order("position", { ascending: true }).order("joined_at", { ascending: true });
    if (error) { console.error("[queue_tickets]", error.message); return; }
    setTickets((data ?? []).map(dbToTicket));
  }, [queueId]);

  useEffect(() => {
    fetch();
    if (!queueId) return;
    const ch = supabase.channel(uniqueTopic(`qtickets:${queueId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets", filter: `queue_id=eq.${queueId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queueId, fetch]);

  return { tickets, refresh: fetch };
}

export async function createQueue(teamId, { title, lieu, scheduledAt, createdBy = null }) {
  const { data, error } = await supabase.from("queues")
    .insert({ team_id: teamId, title: (title || "").trim(), lieu: (lieu || "").trim() || null, scheduled_at: scheduledAt || null, created_by: createdBy })
    .select().single();
  if (error) throw error;
  return dbToQueue(data);
}

export async function updateQueue(id, patch) {
  const row = {};
  if (patch.title != null) row.title = patch.title.trim();
  if (patch.lieu != null) row.lieu = patch.lieu.trim() || null;
  if ("currentFocus" in patch) row.current_focus = (patch.currentFocus || "").trim() || null;
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt || null;
  const { error } = await supabase.from("queues").update(row).eq("id", id);
  if (error) throw error;
}

export async function setQueueStatus(id, status) {
  const { error } = await supabase.from("queues")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw error;
}

export async function deleteQueue(id) {
  const { error } = await supabase.from("queues").delete().eq("id", id); // cascade tickets
  if (error) throw error;
}

// Ajout de joueurs par le staff (fin de file, positions incrémentales). Ignore
// les doublons (contrainte unique queue_id+player_id).
export async function addQueueTickets(queueId, teamId, playerIds) {
  const ids = [...new Set((playerIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const { data: existing } = await supabase.from("queue_tickets").select("player_id, position").eq("queue_id", queueId);
  const has = new Set((existing || []).map((r) => r.player_id));
  let pos = (existing || []).reduce((m, r) => Math.max(m, r.position ?? 0), 0);
  const rows = ids.filter((id) => !has.has(id)).map((id) => ({ queue_id: queueId, team_id: teamId, player_id: id, position: ++pos }));
  if (!rows.length) return 0;
  const { error } = await supabase.from("queue_tickets").insert(rows);
  if (error) throw error;
  return rows.length;
}

// Réordonnancement : positions 1..n dans l'ordre fourni (glisser-déposer validé).
export async function reorderQueueTickets(orderedIds) {
  const ids = (orderedIds || []).filter(Boolean);
  await Promise.all(ids.map((id, i) => supabase.from("queue_tickets").update({ position: i + 1 }).eq("id", id)));
}

// Avancement 0 → 50 → 100 (jalonne started_at / done_at).
export async function setTicketProgress(id, progress) {
  const row = { progress };
  if (progress >= 50) row.started_at = new Date().toISOString();
  row.done_at = progress >= 100 ? new Date().toISOString() : null;
  const { error } = await supabase.from("queue_tickets").update(row).eq("id", id);
  if (error) throw error;
}

export async function setTicketAbsent(id, absent) {
  const { error } = await supabase.from("queue_tickets").update({ absent: !!absent }).eq("id", id);
  if (error) throw error;
}

export async function removeQueueTicket(id) {
  const { error } = await supabase.from("queue_tickets").delete().eq("id", id);
  if (error) throw error;
}

// Auto-inscription du joueur (RPC SECURITY DEFINER, fin de file, idempotente).
export async function joinQueue(queueId) {
  const { data, error } = await supabase.rpc("queue_join", { p_queue: queueId });
  if (error) throw error;
  return data; // ticket id
}
