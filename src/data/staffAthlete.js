import { supabase } from "../lib/supabase.js";

/* Profil athlète du staff (migration 0096). Un compte staff active (opt-in) une
   carte `players` dédiée dans son club → il se suit et concourt au classement à
   égalité avec les joueurs. Ses données privées restent self-only (RLS 0096).
   Idempotent : renvoie l'id de la carte (existante ou nouvellement créée). */
export async function activateStaffAthlete() {
  const { data, error } = await supabase.rpc("activate_staff_athlete");
  if (error) throw error;
  return data; // players.id de la carte athlète
}
