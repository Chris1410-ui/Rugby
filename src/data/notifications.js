import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Notifications in-app du joueur (badge + centre). Générées côté DB par triggers
   (migration 0026). Realtime → pastille/cloche en direct. Le joueur ne fait
   qu'une chose en écriture : marquer ses notifications lues. */

const dbToNotif = (r) => ({ id: r.id, type: r.type, titre: r.titre, body: r.body, refId: r.ref_id, route: r.route, read: r.read, createdAt: r.created_at });

export function useNotifications(playerId) {
  const [list, setList] = useState([]);

  const fetch = useCallback(async () => {
    if (!playerId) { setList([]); return; }
    const { data, error } = await supabase
      .from("notifications").select("*").eq("player_id", playerId)
      .order("created_at", { ascending: false }).limit(100);
    if (error) { console.error("[notifications]", error.message); return; }
    setList((data ?? []).map(dbToNotif));
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase.channel(uniqueTopic(`notif:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  const unread = list.filter((n) => !n.read).length;
  const byRoute = {};
  list.forEach((n) => { if (!n.read && n.route) byRoute[n.route] = (byRoute[n.route] || 0) + 1; });

  const markRead = useCallback(async (id) => {
    setList((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);
  const markAllRead = useCallback(async () => {
    setList((l) => l.map((n) => ({ ...n, read: true })));
    if (playerId) await supabase.from("notifications").update({ read: true }).eq("player_id", playerId).eq("read", false);
  }, [playerId]);
  const markRouteRead = useCallback(async (route) => {
    if (!route) return;
    setList((l) => l.map((n) => (n.route === route ? { ...n, read: true } : n)));
    if (playerId) await supabase.from("notifications").update({ read: true }).eq("player_id", playerId).eq("route", route).eq("read", false);
  }, [playerId]);

  return { list, unread, byRoute, markRead, markAllRead, markRouteRead };
}

/* Bonus « top 2 réactivité » par joueur du club (SECURITY DEFINER, migration 0026)
   → { [playerId]: [{ label, date }] }. Alimente le +15 dans computePoints. */
export function useTeamReactivity(teamId) {
  const [byPlayer, setByPlayer] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_reactivity_bonus", { p_team: teamId });
    if (error) { console.error("[reactivity]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ label: r.label, date: r.at }); });
    setByPlayer(m);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    // Le classement se rafraîchit sur les notifications (proxy de complétion).
    const ch = supabase.channel(uniqueTopic(`reactfeed:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return byPlayer;
}
