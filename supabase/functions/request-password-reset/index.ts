// Edge Function `request-password-reset` — demande de réinitialisation émise par
// un joueur NON authentifié depuis l'écran de connexion (verify_jwt=false).
//
// On résout l'email → joueur/club (SECURITY DEFINER) puis on enregistre une
// demande visible par le staff/owner du club, qui réinitialisera le mot de passe
// depuis la fiche (Edge Function admin-reset-password). Réponse TOUJOURS générique
// (même si l'email est inconnu) pour ne pas révéler quels comptes existent.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const OK = { ok: true, message: "Si un compte existe, ta demande a été transmise au staff." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let email = "";
  let note = "";
  try {
    const b = await req.json();
    email = (b?.email || "").trim();
    note = (b?.note || "").toString().slice(0, 300);
  } catch { /* ignore */ }
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Adresse email invalide." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Email → joueur/club. Inconnu → on renvoie un succès générique (anti-énumération).
  const { data: target } = await admin.rpc("find_reset_target", { p_email: email });
  const row = Array.isArray(target) ? target[0] : target;
  if (!row?.team_id) return json(OK);

  // Dé-doublonnage : une seule demande en attente par joueur.
  const { data: existing } = await admin
    .from("password_reset_requests")
    .select("id")
    .eq("team_id", row.team_id)
    .eq("player_id", row.player_id)
    .eq("status", "pending")
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("password_reset_requests").insert({
      team_id: row.team_id,
      player_id: row.player_id,
      email,
      name: row.name,
      note: note || null,
    });
    if (error) return json({ error: error.message }, 500);
  }

  return json(OK);
});
