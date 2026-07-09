import { supabase } from "../lib/supabase.js";

/* ════════════════════════════════════════════════════════════════
   RGPD côté client — portabilité (export) & effacement.

   - Export : lecture directe via la RLS (le joueur ne voit que ses
     données ; le staff, celles de son équipe). Aucun secret requis.
   - Effacement : délégué à l'Edge Function `gdpr-erase` (service_role),
     seule habilitée à supprimer le compte Auth et à cascader les données.
   ════════════════════════════════════════════════════════════════ */

// Consentement archivé d'un joueur (ou null).
export async function fetchConsent(playerId) {
  if (!playerId) return null;
  const { data, error } = await supabase
    .from("consents")
    .select("guardian_name, guardian_email, minor, policy_version, consent_given, consented_at")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Rassemble toutes les données d'un joueur en un objet exportable.
export async function exportPlayerData(player) {
  const pid = player.id;
  const [checkins, logs, messages, consent] = await Promise.all([
    supabase.from("daily_checkins").select("*").eq("player_id", pid).order("date", { ascending: true }),
    supabase.from("session_logs").select("*").eq("player_id", pid).order("logged_at", { ascending: true }),
    supabase.from("messages").select("*").eq("player_id", pid).order("created_at", { ascending: true }),
    fetchConsent(pid),
  ]);
  for (const r of [checkins, logs, messages]) if (r.error) throw r.error;

  return {
    export: {
      generated_at: new Date().toISOString(),
      subject: "Données personnelles — export RGPD (portabilité)",
      format: "JSON",
    },
    player: {
      id: player.id, name: player.name, num: player.num, pos: player.pos,
      grp: player.grp, team: player.team, age: player.age,
    },
    consent,
    daily_checkins: checkins.data ?? [],
    session_logs: logs.data ?? [],
    messages: messages.data ?? [],
  };
}

// Déclenche un téléchargement navigateur du bundle JSON.
export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// slug simple pour le nom de fichier
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
export const slugify = (s) =>
  (s || "joueur").toLowerCase().normalize("NFD").replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "joueur";

// Effacement définitif via l'Edge Function (auth : self ou staff de l'équipe).
export async function erasePlayer(playerId) {
  const { data, error } = await supabase.functions.invoke("gdpr-erase", {
    body: { player_id: playerId },
  });
  if (error) {
    // Corps d'erreur JSON éventuel renvoyé par la fonction
    let detail = error.message;
    try { detail = (await error.context?.json())?.error || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  return data;
}
