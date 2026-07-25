import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { resolveAssignedIds } from "./sessions.js";
import { uniqueTopic } from "./messages.js";

/* Convocations aux entraînements collectifs + présences (migration 0082).
   Le joueur n'écrit JAMAIS en direct : training_respond est un RPC SECURITY
   DEFINER. Le staff crée/édite les convocations et pointe en écriture directe
   (RLS staff). Points = pointage staff (team_training_events, câblé en PR-D). */

export function dbToTraining(row, roster) {
  return {
    id: row.id, teamId: row.team_id, date: row.date,
    heure: row.heure || "", lieu: row.lieu || "", nature: row.nature || "",
    titre: row.titre || "", notes: row.notes || "",
    assigned: row.assigned || { mode: "all" },
    assignedIds: resolveAssignedIds(row.assigned, roster || []),
    createdBy: row.created_by, createdAt: row.created_at,
  };
}

export const dbToAttendance = (r) => ({
  trainingId: r.training_id, playerId: r.player_id, teamId: r.team_id,
  playerResponse: r.player_response || null, absenceReason: r.absence_reason || "",
  eta: r.eta || "", respondedAt: r.responded_at || null,
  staffStatus: r.staff_status || null, staffAt: r.staff_at || null,
});

// Convocations de l'équipe (staff : toutes ; joueur : les siennes via RLS).
export function useTeamTrainings(teamId, roster) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!teamId) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase.from("trainings").select("*").eq("team_id", teamId).order("date", { ascending: false });
    if (error) { console.error("[trainings]", error.message); setLoading(false); return; }
    setRows(data ?? []); setLoading(false);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`trainings:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "trainings", filter: `team_id=eq.${teamId}` }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  const trainings = rows.map((r) => dbToTraining(r, roster || []));
  return { trainings, loading, refresh: fetch };
}

// Présences de l'équipe → { [trainingId]: { [playerId]: attendance } }.
export function useTeamAttendance(teamId) {
  const [byTraining, setBy] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setBy({}); return; }
    const { data, error } = await supabase.from("training_attendance").select("*").eq("team_id", teamId);
    if (error) { console.error("[attendance]", error.message); return; }
    const m = {}; (data ?? []).forEach((r) => { (m[r.training_id] = m[r.training_id] || {})[r.player_id] = dbToAttendance(r); });
    setBy(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`attendance:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "training_attendance", filter: `team_id=eq.${teamId}` }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return { byTraining, refresh: fetch };
}

/* Events de points de présence par joueur (pointage staff = vérité) →
   { [playerId]: [{ kind, date }] }. Alimente computePoints (câblé en PR-D). */
export function useTeamTrainingEvents(teamId) {
  const [byPlayer, setByPlayer] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_training_events", { p_team: teamId });
    if (error) { console.error("[training events]", error.message); return; }
    const m = {}; (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ kind: r.kind, date: r.at }); });
    setByPlayer(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`trainevents:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "training_attendance", filter: `team_id=eq.${teamId}` }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return { byPlayer, refresh: fetch };
}

// ─── Staff (écriture directe, RLS staff) ───
function trainingRow(teamId, tr, uid) {
  return {
    team_id: teamId, date: tr.date, heure: tr.heure?.trim() || null, lieu: tr.lieu?.trim() || null,
    nature: tr.nature?.trim() || null, titre: tr.titre?.trim() || null, notes: tr.notes?.trim() || null,
    assigned: tr.assigned || { mode: "all" }, created_by: uid,
  };
}
export async function createTraining(teamId, tr) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("trainings").insert(trainingRow(teamId, tr, auth?.user?.id)).select().single();
  if (error) throw error;
  return data;
}
export async function updateTraining(id, patch) {
  const { error } = await supabase.from("trainings").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTraining(id) {
  const { error } = await supabase.from("trainings").delete().eq("id", id); // cascade présences
  if (error) throw error;
}
// Pointage staff (la vérité). status ∈ present|absent|late ; null pour dépointer.
export async function markAttendance(trainingId, playerId, teamId, status) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("training_attendance").upsert({
    training_id: trainingId, player_id: playerId, team_id: teamId,
    staff_status: status, staff_by: auth?.user?.id, staff_at: new Date().toISOString(),
  }, { onConflict: "training_id,player_id" });
  if (error) throw error;
}
export async function remindNonResponders(trainingId) {
  const { data, error } = await supabase.rpc("training_remind", { p_training: trainingId });
  if (error) throw error;
  return data; // nombre de relances envoyées
}

// ─── Joueur (RPC SECURITY DEFINER) ───
export async function respondTraining(trainingId, response, reason = null, eta = null) {
  const { error } = await supabase.rpc("training_respond", {
    p_training: trainingId, p_response: response, p_reason: reason, p_eta: eta,
  });
  if (error) throw error;
}
