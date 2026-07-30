import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Mur d'activité du club (onglet Équipe). Faits pseudonymisés servis par la RPC
   SECURITY DEFINER `team_activity_feed` (0119) : séance validée, check-in, défi,
   convocation, dépôt GPS — jamais de donnée de santé. Le mapping player_id →
   totem+initiales se fait côté écran (players sous RLS club). Rafraîchi en
   direct sur les tables les plus vivantes (séances / check-ins). */
export function useTeamActivityFeed(teamId, limit = 40) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setItems([]); setLoading(false); return; }
    const { data, error } = await supabase.rpc("team_activity_feed", { p_team: teamId, p_limit: limit });
    if (error) { console.error("[team_activity_feed]", error.message); setLoading(false); return; }
    setItems((data ?? []).map((r) => ({ playerId: r.player_id, kind: r.kind, at: r.occurred_at, subject: r.subject })));
    setLoading(false);
  }, [teamId, limit]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`teamfeed:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { items, loading, refresh: fetch };
}
