import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Codes/liens d'invitation par club, DISTINCTS joueur / staff (modèle Twizzit,
   migration 0072). Un code partagé « player » et un « staff » (avec rôle) par
   club, régénérables / révocables / à expiration optionnelle. L'acceptation se
   fait par RPC SECURITY DEFINER qui rattache TOUJOURS au team du code. */

// Lien d'adhésion partagé (distinct de ?invite=<token> des invitations nominatives).
export const joinLink = (code) => `${window.location.origin}/?join=${code}`;

// Aperçu public (pré-remplit l'écran d'inscription) : { valid, kind, role, teamId, club }.
export async function peekInviteCode(code) {
  const { data, error } = await supabase.rpc("peek_invite_code", { p_code: (code || "").trim() });
  if (error) throw error;
  const row = data && typeof data === "object" ? data : null;
  return row ? { valid: !!row.valid, kind: row.kind, role: row.role ?? null, teamId: row.team_id, club: row.club } : null;
}

/* Adhésion via code partagé. staff → profil (role+club) immédiat ; joueur →
   carte pending + totem + consentement. Renvoie { kind, teamId, role?, playerId?,
   status? }. Lève CODE_INVALID / ALREADY_MEMBER / TOTEM_TAKEN / CONSENT_REQUIRED… */
export async function joinClubWithCode(code, { totem, initials, birthdate, guardianName, guardianEmail, policyVersion, consent } = {}) {
  const { data, error } = await supabase.rpc("join_club_with_code", {
    p_code: (code || "").trim(),
    p_totem: totem || null,
    p_initials: initials || null,
    p_birthdate: birthdate || null,
    p_guardian_name: guardianName || null,
    p_guardian_email: guardianEmail || null,
    p_policy_version: policyVersion || null,
    p_consent: !!consent,
  });
  if (error) throw error;
  return { kind: data?.kind, teamId: data?.team_id, role: data?.role ?? null, playerId: data?.player_id ?? null, status: data?.status ?? null };
}

function dbToCode(r) {
  return { id: r.id, teamId: r.team_id, kind: r.kind, role: r.role ?? null, code: r.code, expiresAt: r.expires_at ?? null, active: !!r.active };
}

/* Les deux codes d'un club (gestion staff/owner). RLS : staff écrivain de son
   club ou owner. Realtime pour refléter régénération / changement de rôle. */
export function useClubInviteCodes(teamId) {
  const [codes, setCodes] = useState({ player: null, staff: null });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setCodes({ player: null, staff: null }); setLoading(false); return; }
    const { data, error } = await supabase
      .from("club_invite_codes").select("*").eq("team_id", teamId);
    if (error) { console.error("[club_invite_codes]", error.message); setLoading(false); return; }
    const map = { player: null, staff: null };
    (data ?? []).forEach((r) => { map[r.kind] = dbToCode(r); });
    setCodes(map);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(`club_invite_codes:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_invite_codes", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { codes, loading, refresh: fetch };
}

export async function rotateInviteCode(teamId, kind) {
  const { data, error } = await supabase.rpc("rotate_invite_code", { p_team: teamId, p_kind: kind });
  if (error) throw error;
  return data; // nouveau code
}
export async function setStaffCodeRole(teamId, role) {
  const { error } = await supabase.rpc("set_staff_code_role", { p_team: teamId, p_role: role });
  if (error) throw error;
}
export async function setInviteCodeActive(teamId, kind, active, expiresAt = null) {
  const { error } = await supabase.rpc("set_invite_code_active", { p_team: teamId, p_kind: kind, p_active: active, p_expires_at: expiresAt });
  if (error) throw error;
}
