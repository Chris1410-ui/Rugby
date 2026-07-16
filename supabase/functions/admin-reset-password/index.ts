// Edge Function `admin-reset-password` — réinitialisation du mot de passe d'un
// joueur PAR LE STAFF / L'OWNER (pas d'auto-service côté joueur).
//
// Le staff/owner saisit un nouveau mot de passe pour un joueur de son club ;
// on le pose directement via l'API Admin (service role) — aucun email, aucun
// lien. L'appel est authentifié (verify_jwt=true) : on relit le profil de
// l'appelant côté serveur pour décider (jamais de confiance dans un champ
// fourni par le client), puis on vérifie que le joueur ciblé appartient bien
// à son club (owner : tous les clubs).

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

const STAFF = ["preparateur", "medical", "coach"];

// Mêmes règles de robustesse qu'à l'inscription (miroir de pwdStrength.valid).
function validPassword(p: unknown): p is string {
  return typeof p === "string"
    && p.length >= 10
    && /[a-z]/.test(p) && /[A-Z]/.test(p)
    && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Appelant : identifié par son JWT (déjà vérifié par la passerelle).
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  let callerUid = "";
  try { callerUid = JSON.parse(atob(jwt.split(".")[1] || "")).sub || ""; } catch { /* ignore */ }
  if (!callerUid) return json({ error: "unauthenticated" }, 401);

  let playerId = "";
  let newPassword = "";
  try {
    const b = await req.json();
    playerId = b?.player_id || "";
    newPassword = b?.new_password || "";
  } catch { /* ignore */ }
  if (!playerId) return json({ error: "player_id requis" }, 400);
  if (!validPassword(newPassword)) return json({ error: "Mot de passe trop faible (10+, majuscule, minuscule, chiffre, spécial)." }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Profil de l'appelant (rôle, équipe) — source d'autorité.
  const { data: caller } = await admin
    .from("profiles").select("role, team_id").eq("id", callerUid).maybeSingle();
  if (!caller) return json({ error: "profil appelant introuvable" }, 403);

  // Joueur ciblé.
  const { data: player } = await admin
    .from("players").select("id, team_id, owner_uid, name").eq("id", playerId).maybeSingle();
  if (!player) return json({ error: "joueur introuvable" }, 404);

  // Autorisation : owner (tous clubs) ou staff du MÊME club. Jamais le joueur lui-même.
  const isOwner = caller.role === "owner";
  const isTeamStaff = STAFF.includes(caller.role) && caller.team_id === player.team_id;
  if (!isOwner && !isTeamStaff) return json({ error: "forbidden" }, 403);

  // Le joueur doit avoir un compte (auto-inscription) pour avoir un mot de passe.
  if (!player.owner_uid) return json({ error: "Ce joueur n'a pas de compte (jamais inscrit) — aucun mot de passe à réinitialiser." }, 409);

  const { error: uErr } = await admin.auth.admin.updateUserById(player.owner_uid, { password: newPassword });
  if (uErr) return json({ error: uErr.message }, 500);

  return json({ ok: true, player_id: playerId, name: player.name });
});
