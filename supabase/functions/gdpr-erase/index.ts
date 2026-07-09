// Edge Function `gdpr-erase` — droit à l'effacement (RGPD art. 17).
//
// Supprime définitivement un joueur et TOUTES ses données. Le titulaire du
// compte peut effacer ses propres données ; le staff peut effacer un joueur
// de SON équipe. L'appel est authentifié (verify_jwt=true) : on relit le
// profil de l'appelant côté serveur pour décider (jamais de confiance dans
// un champ fourni par le client).
//
// La suppression de la ligne `players` cascade sur daily_checkins,
// session_logs, messages et consents (FK ON DELETE CASCADE). On retire
// ensuite le profil et, si le joueur avait un compte, l'utilisateur Auth.

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
  try { playerId = (await req.json())?.player_id || ""; } catch { /* ignore */ }
  if (!playerId) return json({ error: "player_id requis" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Profil de l'appelant (rôle, équipe, joueur lié) — source d'autorité.
  const { data: caller } = await admin
    .from("profiles").select("role, team_id, player_id").eq("id", callerUid).maybeSingle();
  if (!caller) return json({ error: "profil appelant introuvable" }, 403);

  // Joueur ciblé.
  const { data: player } = await admin
    .from("players").select("id, team_id, owner_uid, name").eq("id", playerId).maybeSingle();
  if (!player) return json({ error: "joueur introuvable" }, 404);

  const isSelf = caller.player_id === playerId;
  const isTeamStaff = STAFF.includes(caller.role) && caller.team_id === player.team_id;
  if (!isSelf && !isTeamStaff) return json({ error: "forbidden" }, 403);

  // Effacement : players cascade sur checkins/logs/messages/consents.
  const { error: delErr } = await admin.from("players").delete().eq("id", playerId);
  if (delErr) return json({ error: delErr.message }, 500);

  // Profil lié (compte joueur) — pas de FK vers players, on le retire à la main.
  await admin.from("profiles").delete().eq("player_id", playerId);

  // Compte Auth du joueur, s'il en avait un (auto-inscription).
  let authDeleted = false;
  if (player.owner_uid) {
    const { error: uErr } = await admin.auth.admin.deleteUser(player.owner_uid);
    authDeleted = !uErr;
  }

  return json({
    ok: true,
    erased: { player_id: playerId, name: player.name },
    auth_user_deleted: authDeleted,
    by: isSelf ? "self" : "staff",
  });
});
