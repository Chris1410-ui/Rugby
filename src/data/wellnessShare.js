import { supabase } from "../lib/supabase.js";

/* Liens de consultation Wellness (migration 0130). Le token (256 bits) est généré
   et haché CÔTÉ CLIENT : on n'envoie que son SHA-256 ; le token brut ne vit que
   dans l'URL. La page publique lit les données via l'Edge Function (service role). */

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256hex(s) { return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }

// Owner/staff écrivain : crée un lien, renvoie { url, token, id, expiresAt }.
export async function createShareLink({ teamId, ttlHours, label }) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32))); // 64 hex
  const tokenHash = await sha256hex(token);
  const { data, error } = await supabase.rpc("create_wellness_share_link", {
    p_token_hash: tokenHash, p_ttl_hours: ttlHours, p_label: label || null, p_team_id: teamId || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row?.id, expiresAt: row?.expires_at, token, url: `${window.location.origin}/?wellness=${token}` };
}

export async function listShareLinks(teamId) {
  if (!teamId) return [];
  const { data, error } = await supabase
    .from("wellness_share_links")
    .select("id, label, expires_at, revoked, created_at, last_viewed_at, view_count")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function revokeShareLink(id) {
  const { error } = await supabase.rpc("revoke_wellness_share_link", { p_id: id });
  if (error) throw error;
}

// Page publique : lit les données Wellness via l'Edge Function (sans session).
export async function fetchSharedWellness(token) {
  const { data, error } = await supabase.functions.invoke("wellness-share", { body: { token } });
  if (error) throw error;
  if (!data || data.error) throw new Error(data?.error || "invalid_or_expired");
  return data; // { teamId, roster:[{id,name,initials}], rows:[{playerId,date,wb,createdAt}] }
}
