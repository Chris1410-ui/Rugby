import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { resolveAssignedIds } from "./sessions.js";
import { uniqueTopic } from "./messages.js";

/* Défis (challenges) + validation en 2 temps. Le joueur n'écrit jamais en direct :
   challenge_mark_done / challenge_unmark sont des RPC SECURITY DEFINER (migration
   0031). Le staff confirme/refuse en écriture directe (RLS staff). Points =
   confirmee uniquement (team_challenge_points). */

export function dbToChallenge(row, roster) {
  return {
    id: row.id, teamId: row.team_id, titre: row.titre, description: row.description || "",
    points: row.points ?? 10, heure: row.heure || "", lieu: row.lieu || "",
    materiel: Array.isArray(row.materiel) ? row.materiel : [],
    echeance: row.echeance || null, assigned: row.assigned || { mode: "all" },
    assignedIds: resolveAssignedIds(row.assigned, roster || []),
    banner: row.banner || "flame", badge: row.badge || "🏆",
    createdAt: row.created_at,
  };
}
const dbToCompletion = (r) => ({ challengeId: r.challenge_id, playerId: r.player_id, statut: r.statut, validatedAt: r.validated_at, confirmedAt: r.confirmed_at });

export function useTeamChallenges(teamId, roster) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!teamId) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase.from("challenges").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) { console.error("[challenges]", error.message); setLoading(false); return; }
    setRows(data ?? []); setLoading(false);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`challenges:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `team_id=eq.${teamId}` }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  const challenges = rows.map((r) => dbToChallenge(r, roster || []));
  return { challenges, loading, refresh: fetch };
}

export function useTeamChallengeCompletions(teamId) {
  const [byChallenge, setBy] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setBy({}); return; }
    const { data, error } = await supabase.from("challenge_completions").select("*").eq("team_id", teamId);
    if (error) { console.error("[challenge completions]", error.message); return; }
    const m = {}; (data ?? []).forEach((r) => { (m[r.challenge_id] = m[r.challenge_id] || {})[r.player_id] = dbToCompletion(r); });
    setBy(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`chcomp:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_completions", filter: `team_id=eq.${teamId}` }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return { byChallenge, refresh: fetch };
}

export function useMyChallengeCompletions(playerId) {
  const [byChallenge, setBy] = useState({});
  const fetch = useCallback(async () => {
    if (!playerId) { setBy({}); return; }
    const { data, error } = await supabase.from("challenge_completions").select("challenge_id, statut").eq("player_id", playerId);
    if (error) { console.error("[my challenge completions]", error.message); return; }
    const m = {}; (data ?? []).forEach((r) => { m[r.challenge_id] = r.statut; });
    setBy(m);
  }, [playerId]);
  useEffect(() => {
    fetch(); if (!playerId) return;
    const ch = supabase.channel(uniqueTopic(`mychal:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_completions", filter: `player_id=eq.${playerId}` }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);
  return { statutByChallenge: byChallenge, refresh: fetch };
}

/* Points de défis par joueur (confirmee) → { [playerId]: [{ titre, points, date }] }. */
export function useTeamChallengePoints(teamId) {
  const [byPlayer, setByPlayer] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_challenge_points", { p_team: teamId });
    if (error) { console.error("[team_challenge_points]", error.message); return; }
    const m = {}; (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ titre: r.titre, points: r.points, date: r.at }); });
    setByPlayer(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`chalpts:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_completions" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return byPlayer;
}

/* Agrégat par défi (relevés / confirmés) pour la barre de progression, visible
   par tout le club (RPC SECURITY DEFINER). */
export function useTeamChallengeStats(teamId) {
  const [byChallenge, setBy] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setBy({}); return; }
    const { data, error } = await supabase.rpc("team_challenge_stats", { p_team: teamId });
    if (error) { console.error("[team_challenge_stats]", error.message); return; }
    const m = {}; (data ?? []).forEach((r) => { m[r.challenge_id] = { releves: r.releves, confirmes: r.confirmes }; });
    setBy(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`chalstats:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_completions" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return byChallenge;
}

// ── Écritures (staff) ──
function challengeRow(teamId, c, uid) {
  return {
    team_id: teamId, titre: (c.titre || "").trim(), description: c.description?.trim() || null,
    points: Number.isFinite(+c.points) ? Math.max(0, Math.min(500, Math.round(+c.points))) : 10,
    heure: c.heure?.trim() || null, lieu: c.lieu?.trim() || null,
    materiel: Array.isArray(c.materiel) ? c.materiel : [],
    echeance: c.echeance || null, assigned: c.assigned || { mode: "all" },
    banner: c.banner || "flame", badge: c.badge || "🏆", created_by: uid,
  };
}
export async function createChallenge(teamId, c) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("challenges").insert(challengeRow(teamId, c, auth?.user?.id)).select().single();
  if (error) throw error;
  return data;
}
export async function createChallengesBulk(teamId, list) {
  if (!list?.length) return;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("challenges").insert(list.map((c) => challengeRow(teamId, c, auth?.user?.id)));
  if (error) throw error;
}
export async function updateChallenge(id, patch) {
  const { error } = await supabase.from("challenges").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteChallenge(id) {
  const { error } = await supabase.from("challenges").delete().eq("id", id); // cascade completions
  if (error) throw error;
}

// Joueur (RPC).
export async function markChallengeDone(id) { const { error } = await supabase.rpc("challenge_mark_done", { p_challenge: id }); if (error) throw error; }
export async function unmarkChallenge(id) { const { error } = await supabase.rpc("challenge_unmark", { p_challenge: id }); if (error) throw error; }
// « Je ne participe pas » → statut refuse (RPC SECURITY DEFINER, migration 0044).
export async function declineChallenge(id) { const { error } = await supabase.rpc("challenge_decline", { p_challenge: id }); if (error) throw error; }

// Coach (écriture directe RLS staff).
export async function confirmChallenge(challengeId, playerId, teamId) {
  const { error } = await supabase.from("challenge_completions")
    .upsert({ challenge_id: challengeId, player_id: playerId, team_id: teamId, statut: "confirmee", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "challenge_id,player_id" });
  if (error) throw error;
}
export async function refuseChallenge(challengeId, playerId) {
  const { error } = await supabase.from("challenge_completions")
    .update({ statut: "a_faire", validated_at: null, confirmed_at: null, updated_at: new Date().toISOString() })
    .eq("challenge_id", challengeId).eq("player_id", playerId);
  if (error) throw error;
}
