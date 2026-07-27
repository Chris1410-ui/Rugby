import { supabase } from "../lib/supabase.js";

/* Surcharges individuelles d'un PROTOCOLE (table protocol_player_overrides).
   Un protocole reste une seule entité (le « socle ») ; ce qui est modifié « au
   nom d'un joueur » vit ici comme des patches atomiques adressés par `path`
   (jamais une copie du protocole). Résolution socle→surcharge :
   src/lib/program/overrides.js. Écritures gardées par la RLS (owner / staff
   écrivain de l'équipe). */

export function dbToOverride(r) {
  return {
    id: r.id,
    programDocId: r.program_doc_id,
    playerId: r.player_id,
    teamId: r.team_id,
    path: r.path,
    op: r.op || "patch",
    value: r.value || {},
  };
}

// Toutes les surcharges d'un protocole (vue staff : tous les joueurs).
export async function overridesForDoc(programDocId) {
  if (!programDocId) return [];
  const { data, error } = await supabase
    .from("protocol_player_overrides").select("*").eq("program_doc_id", programDocId);
  if (error) throw error;
  return (data ?? []).map(dbToOverride);
}

// Surcharges d'UN joueur pour un protocole.
export async function overridesForPlayer(programDocId, playerId) {
  if (!programDocId || !playerId) return [];
  const { data, error } = await supabase
    .from("protocol_player_overrides").select("*")
    .eq("program_doc_id", programDocId).eq("player_id", playerId);
  if (error) throw error;
  return (data ?? []).map(dbToOverride);
}

/* Crée / écrase une surcharge (une seule par (doc, joueur, path)). `op` :
   'patch' (défaut) fusion de champs · 'remove' retrait · 'add' ajout. */
export async function setOverride(teamId, { programDocId, playerId, path, op = "patch", value = {} }) {
  const { data, error } = await supabase
    .from("protocol_player_overrides")
    .upsert(
      { program_doc_id: programDocId, player_id: playerId, team_id: teamId, path, op, value, updated_at: new Date().toISOString() },
      { onConflict: "program_doc_id,player_id,path" },
    )
    .select().single();
  if (error) throw error;
  return dbToOverride(data);
}

// Réinitialise UNE surcharge (retour au socle sur ce chemin).
export async function resetOverride(programDocId, playerId, path) {
  const { error } = await supabase
    .from("protocol_player_overrides").delete()
    .eq("program_doc_id", programDocId).eq("player_id", playerId).eq("path", path);
  if (error) throw error;
}

// Réinitialise TOUTES les surcharges d'un joueur (retour complet au socle).
export async function resetAllOverrides(programDocId, playerId) {
  const { error } = await supabase
    .from("protocol_player_overrides").delete()
    .eq("program_doc_id", programDocId).eq("player_id", playerId);
  if (error) throw error;
}
