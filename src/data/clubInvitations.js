import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Invitations de club (migration 0057). Un compte (staff ou joueur) ne se
   rattache à un club QUE via une invitation validée par un admin du club. L'admin
   émet un lien À COPIER ; l'invité crée son compte puis `accept_club_invitation`
   (SECURITY DEFINER) élève son profil au rôle+club portés par l'invitation. */

const genToken = () =>
  (globalThis.crypto?.randomUUID?.() || `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`).replace(/-/g, "");

export const inviteLink = (token) => `${window.location.origin}/?invite=${token}`;

function dbToInvite(r) {
  return {
    id: r.id, clubId: r.club_id, role: r.role, email: r.email || null,
    playerId: r.player_id || null, token: r.token, status: r.status,
    createdAt: r.created_at, expiresAt: r.expires_at, acceptedAt: r.accepted_at || null,
  };
}

export function useClubInvitations(clubId) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clubId) return;
    const { data, error } = await supabase
      .from("club_invitations")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[club_invitations]", error.message); setLoading(false); return; }
    setInvites((data ?? []).map(dbToInvite));
    setLoading(false);
  }, [clubId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { invites, loading, refresh: fetch };
}

/* Émet une invitation. role ∈ preparateur/medical/coach (staff) ou joueur.
   Pour un joueur, `playerId` (carte roster à revendiquer) est OBLIGATOIRE
   (contrainte serveur club_inv_player_chk). Renvoie le token → inviteLink. */
export async function createClubInvitation(clubId, { role, email, playerId = null }) {
  if (!clubId || !role) throw new Error("NO_TARGET");
  if (role === "joueur" && !playerId) throw new Error("PLAYER_REQUIRED");
  const token = genToken();
  const { error } = await supabase
    .from("club_invitations")
    .insert({ club_id: clubId, role, email: email?.trim() || null, player_id: role === "joueur" ? playerId : null, token });
  if (error) throw error;
  return token;
}

export async function revokeClubInvitation(id) {
  const { error } = await supabase.from("club_invitations").delete().eq("id", id);
  if (error) throw error;
}

// Aperçu (rôle + club) avant acceptation, pour adapter l'écran d'inscription.
export async function peekClubInvitation(token) {
  const { data, error } = await supabase.rpc("peek_club_invitation", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { role: row.role, clubId: row.club_id, hasEmail: row.has_email } : null;
}

/* Acceptation après inscription : élève le profil de l'appelant depuis l'invite.
   Consentement parental (mineur) optionnel — requis côté UI pour un joueur. */
export async function acceptClubInvitation(token, { guardianName, guardianEmail, policyVersion, consent } = {}) {
  const { error } = await supabase.rpc("accept_club_invitation", {
    p_token: token,
    p_guardian_name: guardianName || null,
    p_guardian_email: guardianEmail || null,
    p_policy_version: policyVersion || null,
    p_consent: !!consent,
  });
  if (error) throw error;
}
