import { supabase } from "../lib/supabase.js";

/* Marque le tour guidé comme VU pour le profil courant (RPC SECURITY DEFINER :
   n'écrit que profiles.onboarding_seen_at de son propre compte, cf. 0049). */
export async function markOnboardingSeen() {
  const { error } = await supabase.rpc("set_my_onboarding_seen");
  if (error) throw error;
}
