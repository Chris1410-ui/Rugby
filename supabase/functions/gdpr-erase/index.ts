// Edge Function `gdpr-erase` — droit à l'effacement (RGPD art. 17).
//
// Supprime définitivement un joueur et TOUTES ses données. Autorisé pour :
//   - le titulaire du compte (self) — depuis « Mes données » ;
//   - le STAFF écrivain de l'équipe du joueur (preparateur / medical) ;
//   - l'OWNER (multi-clubs, team_id NULL) — sur N'IMPORTE quel joueur.
// L'appel est authentifié (verify_jwt=true) : on relit le profil de l'appelant
// côté serveur (jamais de confiance dans un champ client).
//
// Effacement complet :
//   - la ligne `players` cascade sur ~22 tables enfant (FK ON DELETE CASCADE) ;
//   - fichiers Storage du joueur (bucket player-files : <team>/<player>/*) ;
//   - profil lié (profiles.player_id — pas de FK) ;
//   - compte Auth (auth.users) si le joueur en avait un ;
//   - trace RGPD dans `erasure_log` (qui, quand, totem, club).
// Confirmation explicite pour une suppression par un tiers : `confirm_totem`
// doit correspondre exactement au totem (players.name).

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
const WRITER_STAFF = ["preparateur", "medical"]; // coach = lecture seule (ne supprime pas)

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
  let confirmTotem = "";
  try {
    const b = await req.json();
    playerId = b?.player_id || "";
    confirmTotem = (b?.confirm_totem ?? "").toString();
  } catch { /* ignore */ }
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

  // ── Autorisation ──
  const isSelf = caller.player_id === playerId;
  const isOwner = caller.role === "owner";                                   // owner = admin global
  const isTeamWriter = WRITER_STAFF.includes(caller.role) && caller.team_id === player.team_id;
  if (!isSelf && !isOwner && !isTeamWriter) return json({ error: "forbidden" }, 403);
  const actorKind = isSelf ? "self" : isOwner ? "owner" : "staff";

  // Confirmation par totem pour une suppression PAR UN TIERS (jamais silencieuse).
  if (!isSelf && confirmTotem.trim() !== (player.name || "").trim()) {
    return json({ error: "totem_mismatch" }, 400);
  }

  // ── Fichiers Storage du joueur (bucket player-files : <team>/<player>/*) ──
  let storageRemoved = 0;
  try {
    const folder = `${player.team_id}/${playerId}`;
    const { data: files } = await admin.storage.from("player-files").list(folder, { limit: 1000 });
    const paths = (files || []).filter((f) => f.name).map((f) => `${folder}/${f.name}`);
    if (paths.length) {
      const { error: rmErr } = await admin.storage.from("player-files").remove(paths);
      if (!rmErr) storageRemoved = paths.length;
    }
  } catch { /* best-effort : ne bloque pas l'effacement des données */ }

  // ── Effacement des données : players cascade sur les ~22 tables enfant ──
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

  // ── Trace RGPD (append-only) ──
  await admin.from("erasure_log").insert({
    player_id: playerId, totem: player.name, team_id: player.team_id,
    actor_uid: callerUid, actor_role: caller.role, actor_kind: actorKind,
    storage_removed: storageRemoved, auth_deleted: authDeleted,
  });

  return json({
    ok: true,
    erased: { player_id: playerId, name: player.name },
    auth_user_deleted: authDeleted,
    storage_removed: storageRemoved,
    by: actorKind,
  });
});
