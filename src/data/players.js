import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Mappe une ligne DB `players` → la forme camelCase attendue par le moteur
   métier (lib/metrics.js). Les valeurs seed alimentent le moteur de charge/risque. */
export function dbToPlayer(row) {
  return {
    id: row.id,
    team: row.team_id,
    ownerUid: row.owner_uid,
    num: row.num,
    name: row.name,
    initials: row.initials ?? null,
    pos: row.pos,
    grp: row.grp,
    club: row.club,
    age: row.age,
    acwr: Number(row.acwr_seed ?? 1.0),
    wellness: row.wellness ?? 35,
    sleep: Number(row.sleep_h ?? 7.5),
    risque: row.risque ?? 30,
    charge7j: row.charge7j ?? 1800,
    dispo: row.dispo ?? 90,
    mas: row.mas,
    backSquat: Number(row.back_squat ?? 1.2),
    cmjG: row.cmj_g,
    cmjD: row.cmj_d,
    ischiosG: row.ischios_g ?? 300,
    ischiosD: row.ischios_d ?? 300,
    asym: row.asym ?? 0,
    bronco: row.bronco ?? null,
    yoyo: row.yoyo != null ? Number(row.yoyo) : null,
    squat5rm: row.squat_5rm ?? null,
    cmjOverall: row.cmj_overall != null ? Number(row.cmj_overall) : null,
    bench5rm: row.bench_5rm != null ? Number(row.bench_5rm) : null,
    hangClean2rm: row.hang_clean_2rm != null ? Number(row.hang_clean_2rm) : null,
    ppNotes: row.pp_notes ?? null,
    isCustom: row.is_custom,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

/* Liste de l'effectif d'une équipe, triée (num puis nom) pour un affichage
   stable — un ajout ne « disparaît » pas en bas de liste (cf. MIGRATION §4).
   S'abonne au Realtime : tout ajout/màj est reflété en direct chez le staff. */
export function useRoster(teamId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoster = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const sorted = (data ?? [])
      .map(dbToPlayer)
      .sort((a, b) => (a.num ?? 999) - (b.num ?? 999) || a.name.localeCompare(b.name));
    setPlayers(sorted);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchRoster();
    if (!teamId) return;
    const channel = supabase
      .channel(`players:${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `team_id=eq.${teamId}` },
        () => fetchRoster()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchRoster]);

  return { players, loading, error, refresh: fetchRoster };
}

/* Liste plate de l'effectif d'un club (réels + démo) pour le sélecteur
   « Vue joueur » de l'owner — lecture seule, triée num puis nom. Les joueurs de
   démo sont marqués pour être distingués visuellement dans le sélecteur. */
export async function fetchTeamPlayers(teamId) {
  const { data, error } = await supabase
    .from("players").select("id, name, initials, pos, grp, num, is_demo").eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []).sort((a, b) => (a.num ?? 999) - (b.num ?? 999) || a.name.localeCompare(b.name));
}

/* Ajout d'un joueur par le staff (RLS players_staff). `initials` optionnel. */
export async function addPlayer(teamId, { name, pos, grp, num, initials }) {
  const { data, error } = await supabase
    .from("players")
    .insert({ team_id: teamId, name: name.trim(), pos, grp, num: num || null, initials: (initials || "").trim() || null })
    .select()
    .single();
  if (error) throw error;
  return dbToPlayer(data);
}

/* Le joueur modifie SES initiales (RPC SECURITY DEFINER — ne touche que
   `initials` de sa propre ligne ; cf. migration 0038). */
export async function setMyInitials(initials) {
  const { error } = await supabase.rpc("set_my_initials", { p_initials: (initials || "").trim() });
  if (error) throw error;
}

/* Mise à jour d'un joueur (staff). `patch` en colonnes DB (snake_case). */
export async function updatePlayer(id, patch) {
  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) throw error;
}

/* Réinitialisation du mot de passe d'un joueur PAR LE STAFF / L'OWNER.
   Passe par l'Edge Function `admin-reset-password` (service role + contrôle
   d'autorité côté serveur) : le staff pose directement un nouveau mot de passe,
   sans email ni lien. Renvoie l'erreur métier du serveur si présente. */
export async function resetPlayerPassword(playerId, newPassword) {
  const { data, error } = await supabase.functions.invoke("admin-reset-password", {
    body: { player_id: playerId, new_password: newPassword },
  });
  if (error) {
    let msg = error.message;
    try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/* Demande de réinitialisation émise par un JOUEUR non authentifié (écran de
   connexion). Passe par l'Edge Function publique `request-password-reset` qui
   route la demande vers le staff/owner du club. Réponse générique. */
export async function requestPasswordReset(email, note) {
  const { data, error } = await supabase.functions.invoke("request-password-reset", {
    body: { email, note },
  });
  if (error) {
    let msg = error.message;
    try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

/* Demandes de réinitialisation en attente pour le club (staff/owner). Realtime →
   la pastille/bannière se met à jour en direct. */
export function usePasswordResetRequests(teamId) {
  const [requests, setRequests] = useState([]);

  const fetch = useCallback(async () => {
    if (!teamId) { setRequests([]); return; }
    const { data, error } = await supabase
      .from("password_reset_requests")
      .select("*").eq("team_id", teamId).eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) { console.error("[reset requests]", error.message); return; }
    setRequests(data ?? []);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`prr:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "password_reset_requests", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { requests, refresh: fetch };
}

// Marque une demande comme traitée (retirée de la file).
export async function markResetHandled(id) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("password_reset_requests")
    .update({ status: "done", handled_at: new Date().toISOString(), handled_by: auth?.user?.id })
    .eq("id", id);
  if (error) throw error;
}
