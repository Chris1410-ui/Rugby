// Edge Function « wellness-share » — sert les données Wellness d'un club à un
// lien de consultation PUBLIC (sans compte). Valide le token (haché), journalise
// la vue, et renvoie UNIQUEMENT le roster pseudonymisé (totem + initiales, hors
// démo) + les bilans du matin sur 14 jours. Aucune session, aucun nom civil,
// aucun autre club. Lecture via service role (hors RLS) ; écriture limitée au
// journal + compteur de vues.
//
// Secrets : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injectés automatiquement).

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let token = "";
  try { token = String((await req.json())?.token ?? "").trim(); } catch { /* corps invalide */ }
  // Token = 64 hex (256 bits). Réponse générique si invalide (pas d'oracle).
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "invalid_or_expired" }, 404);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const hash = await sha256hex(token);
  const { data: link } = await admin
    .from("wellness_share_links")
    .select("id, team_id, revoked, expires_at, view_count")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!link || link.revoked || new Date(link.expires_at).getTime() < Date.now()) {
    return json({ error: "invalid_or_expired" }, 404);
  }

  // Roster pseudonymisé (hors démo) : totem + initiales uniquement.
  const { data: players } = await admin
    .from("players")
    .select("id, name, initials")
    .eq("team_id", link.team_id)
    .eq("is_demo", false);
  const ids = (players ?? []).map((p: { id: string }) => p.id);

  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  let rows: Array<Record<string, unknown>> = [];
  if (ids.length) {
    const { data } = await admin
      .from("daily_checkins")
      .select("player_id, date, wb, created_at")
      .in("player_id", ids)
      .eq("moment", "matin")
      .gte("date", since);
    rows = data ?? [];
  }

  // Journalisation (date, lien) + compteur de vues.
  await admin.from("wellness_share_views").insert({
    link_id: link.id,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
  });
  await admin.from("wellness_share_links")
    .update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count ?? 0) + 1 })
    .eq("id", link.id);

  return json({
    teamId: link.team_id,
    roster: (players ?? []).map((p: { id: string; name: string; initials: string | null }) => ({ id: p.id, name: p.name, initials: p.initials })),
    rows: rows.map((r) => ({ playerId: r.player_id, date: r.date, wb: r.wb ?? {}, createdAt: r.created_at })),
  });
});
