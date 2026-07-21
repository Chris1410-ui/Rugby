import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Invitations STAFF (migration 0057). Le staff ne s'auto-rattache plus à un club :
   l'owner ou un staff écrivain émet une invitation (rôle + club portés côté
   serveur), transmise par un LIEN À COPIER. L'invité crée son compte puis
   « redeem » élève son profil via une fonction SECURITY DEFINER. */

const genToken = () =>
  (globalThis.crypto?.randomUUID?.() || `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`).replace(/-/g, "");

// Lien d'invitation à copier (query param lu par l'écran de connexion).
export const inviteLink = (token) => `${window.location.origin}/?invite=${token}`;

function dbToInvite(r) {
  return {
    id: r.id, teamId: r.team_id, role: r.role, email: r.email || null,
    token: r.token, createdAt: r.created_at, expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at || null,
  };
}

export function useStaffInvites(teamId) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("staff_invites")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[staff_invites]", error.message); setLoading(false); return; }
    setInvites((data ?? []).map(dbToInvite));
    setLoading(false);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { invites, loading, refresh: fetch };
}

// Émet une invitation ; renvoie le token (→ inviteLink). role ∈ preparateur/medical/coach.
export async function createStaffInvite(teamId, { role, email }) {
  if (!teamId || !role) throw new Error("NO_TARGET");
  const token = genToken();
  const { error } = await supabase
    .from("staff_invites")
    .insert({ team_id: teamId, role, email: email?.trim() || null, token });
  if (error) throw error;
  return token;
}

export async function revokeStaffInvite(id) {
  const { error } = await supabase.from("staff_invites").delete().eq("id", id);
  if (error) throw error;
}

// Appelée après l'inscription de l'invité : élève son profil (rôle+club) depuis
// l'invite. Le rôle ne transite jamais par le client.
export async function redeemStaffInvite(token) {
  const { error } = await supabase.rpc("redeem_staff_invite", { p_token: token });
  if (error) throw error;
}
