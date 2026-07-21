import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Auto-inscription joueur (migration 0061) : double garde-fou code club +
   validation staff. Le staff reste invitation-only. Toutes les vérifications
   sensibles (code, autorisation) sont côté serveur (RPC SECURITY DEFINER). */

// Liste des clubs (nom seulement) pour le sélecteur — appelable sans compte.
export async function listClubs() {
  const { data, error } = await supabase.rpc("list_clubs");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, label: r.label }));
}

// Pré-validation avant création de compte : { codeOk, totemFree }. Évite un
// compte orphelin sur code/totem erroné (le serveur re-vérifie à la demande).
export async function precheckMembership(clubId, code, totem) {
  const { data, error } = await supabase.rpc("precheck_membership", { p_club_id: clubId, p_code: code, p_totem: totem });
  if (error) throw error;
  return { codeOk: !!data?.code_ok, totemFree: !!data?.totem_free };
}

/* Demande d'adhésion (après signUp). Crée le joueur en « pending ». Lève une
   erreur portant un code serveur (BAD_CODE, TOTEM_TAKEN, ALREADY_MEMBER,
   CONSENT_REQUIRED…) pour un message adapté côté UI. */
export async function requestClubMembership({ clubId, code, totem, initials, birthdate, guardianName, guardianEmail, policyVersion, consent }) {
  const { data, error } = await supabase.rpc("request_club_membership", {
    p_club_id: clubId,
    p_code: code,
    p_totem: totem,
    p_initials: initials || null,
    p_birthdate: birthdate || null,
    p_guardian_name: guardianName || null,
    p_guardian_email: guardianEmail || null,
    p_policy_version: policyVersion || null,
    p_consent: !!consent,
  });
  if (error) throw error;
  return data; // player id
}

// Validation / refus d'une demande par le staff/owner.
export async function setMembershipStatus(playerId, status) {
  const { error } = await supabase.rpc("set_membership_status", { p_player_id: playerId, p_status: status });
  if (error) throw error;
}

// Régénère le code d'adhésion du club → renvoie le nouveau code.
export async function regenerateJoinCode(clubId) {
  const { data, error } = await supabase.rpc("regenerate_join_code", { p_club_id: clubId });
  if (error) throw error;
  return data;
}

// Code d'adhésion courant du club (lisible par le staff via teams_read).
export async function fetchJoinCode(clubId) {
  if (!clubId) return null;
  const { data, error } = await supabase.from("teams").select("join_code").eq("id", clubId).maybeSingle();
  if (error) throw error;
  return data?.join_code ?? null;
}

/* Demandes d'adhésion EN ATTENTE du club (vue staff). RLS players (équipe) : le
   staff voit les joueurs pending de SON club. Realtime : la liste et la pastille
   se mettent à jour en direct à chaque nouvelle demande / décision. */
export function useMembershipRequests(teamId) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setRequests([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("players")
      .select("id, name, initials, membership_requested_at")
      .eq("team_id", teamId)
      .eq("membership_status", "pending")
      .order("membership_requested_at", { ascending: true });
    if (error) { console.error("[membership requests]", error.message); setLoading(false); return; }
    setRequests((data ?? []).map((r) => ({ id: r.id, name: r.name, initials: r.initials || null, requestedAt: r.membership_requested_at })));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`membership:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { requests, loading, refresh: fetch };
}
