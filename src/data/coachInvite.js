import { supabase } from "../lib/supabase.js";

/* Invitation « head coach » par lien magique (passwordless). Réutilise
   club_invitations (role 'coach') + rôle coach lecture seule. L'envoi du lien
   passe par Supabase Auth (signInWithOtp), dont le SMTP est Resend. */

const redirectTo = () => (typeof window !== "undefined" ? window.location.origin : undefined);

/* Owner/staff écrivain : crée l'invitation (RPC self-check) puis envoie le lien
   magique au coach. shouldCreateUser crée le compte Auth ; data.full_name est
   posé en métadonnées (repli si l'invitation n'a pas de nom). */
export async function inviteHeadCoach({ email, fullName, teamId }) {
  const mail = (email || "").trim();
  const { error: e1 } = await supabase.rpc("invite_head_coach", {
    p_email: mail, p_full_name: fullName || null, p_team_id: teamId || null,
  });
  if (e1) throw e1;
  const { error: e2 } = await supabase.auth.signInWithOtp({
    email: mail,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo(), data: { full_name: fullName || null } },
  });
  if (e2) throw e2;
}

/* 1er atterrissage (session sans profil) : réclame l'invitation coach par email
   (serveur). Renvoie true si un profil coach a été créé. */
export async function claimCoachInvite() {
  const { data, error } = await supabase.rpc("claim_coach_invite");
  if (error) throw error;
  return !!data;
}

/* Reconnexion : renvoie un lien magique (utilisateur existant uniquement →
   pas de création de compte accidentelle). */
export async function sendCoachMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: (email || "").trim(),
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo() },
  });
  if (error) throw error;
}
