import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Web Push (joueur) : souscription du navigateur + enregistrement en base.
   L'ENVOI se fait côté serveur (Edge Function, PR séparée). Ici on ne gère que
   l'abonnement/désabonnement de l'appareil courant. */

/* Abonnements push du club (staff/owner) : lecture seule des lignes
   `push_subscriptions` de l'équipe (RLS `push_staff_read`). Sert à voir d'un
   coup qui recevra les push (et qui relancer). Realtime : la liste se met à jour
   en direct quand un joueur (dés)active ses notifications. */
export function useTeamPushSubscriptions(teamId) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setSubs([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, player_id, endpoint, user_agent, updated_at, created_at")
      .eq("team_id", teamId);
    if (error) { console.error("[push subs]", error.message); setLoading(false); return; }
    setSubs(data ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`push_subs:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "push_subscriptions", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { subs, loading, refresh: fetch };
}

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export function pushSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator
    && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

// Clé VAPID publique (base64url) → Uint8Array attendu par pushManager.subscribe.
// ROBUSTE : on retire tout blanc (espace / retour à la ligne collé dans l'env
// Vercel) AVANT de calculer le padding — sinon atob() lève « The string contains
// invalid characters » sur iOS/Safari (bug observé à l'activation des push).
export function urlBase64ToUint8Array(base64String) {
  const clean = String(base64String || "").replace(/\s+/g, "");        // trim + newlines internes
  const base64 = (clean + "=".repeat((4 - (clean.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Ligne DB à partir d'une PushSubscription (extrait pour testabilité).
export function subscriptionRow(playerId, teamId, subJson, userAgent = "") {
  return {
    player_id: playerId,
    team_id: teamId,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys?.p256dh || null,
    auth: subJson.keys?.auth || null,
    user_agent: userAgent || null,
    updated_at: new Date().toISOString(),
  };
}

async function pushRegistration() {
  return (await navigator.serviceWorker.getRegistration("/push-sw.js"))
    || (await navigator.serviceWorker.getRegistration());
}

/* État courant : unsupported | denied | default (jamais demandé) |
   granted (autorisé mais pas abonné ici) | subscribed. */
export async function getPushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await pushRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) return "subscribed";
  return Notification.permission === "granted" ? "granted" : "default";
}

export async function enablePush(playerId, teamId) {
  if (!pushSupported()) throw new Error("Notifications non supportées sur cet appareil.");
  if (!VAPID_PUBLIC_KEY) throw new Error("Configuration push incomplète (clé VAPID publique manquante).");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Autorisation refusée par le navigateur.");
  const reg = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const row = subscriptionRow(playerId, teamId, sub.toJSON(), navigator.userAgent);
  const { error } = await supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) throw error;
  return "subscribed";
}

export async function disablePush() {
  const reg = await pushRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return "granted";
  const { endpoint } = sub;
  try { await sub.unsubscribe(); } catch { /* noop */ }
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return "granted";
}
