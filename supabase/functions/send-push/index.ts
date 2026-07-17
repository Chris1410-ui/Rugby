// Edge Function `send-push` — envoie une notification Web Push aux appareils
// abonnés d'UN joueur. Appelée en interne par un trigger DB (pg_net) à chaque
// insertion dans `notifications` ; JAMAIS par un client final.
//
// Authentification : secret partagé `x-push-secret` (verify_jwt=false). Le corps
// vient du trigger (source de confiance). Lecture des souscriptions via le
// service role (bypass RLS). Les endpoints expirés (404/410) sont purgés.
//
// Secrets requis (variables d'environnement de la fonction) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url), VAPID_SUBJECT (mailto:…),
//   PUSH_HOOK_SECRET (identique au secret Vault `push_hook_secret`).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Auth interne : secret partagé avec le trigger DB.
  const secret = req.headers.get("x-push-secret");
  const expected = Deno.env.get("PUSH_HOOK_SECRET");
  if (!expected || secret !== expected) return json({ error: "unauthorized" }, 401);

  let payloadIn: Record<string, unknown>;
  try { payloadIn = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const playerId = payloadIn.player_id as string | undefined;
  if (!playerId) return json({ error: "player_id requis" }, 400);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@example.com";
  if (!vapidPublic || !vapidPrivate) return json({ error: "VAPID keys manquantes" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("player_id", playerId);
  if (error) return json({ error: error.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, removed: 0, total: 0 });

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const body = JSON.stringify({
    title: (payloadIn.title as string) || "Performance",
    body: (payloadIn.body as string) || "",
    route: (payloadIn.route as string) || null,
    tag: (payloadIn.tag as string) || (payloadIn.type as string) || undefined,
    url: "/",
  });

  let sent = 0, removed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      }
    }
  }));

  return json({ sent, removed, total: subs.length });
});
