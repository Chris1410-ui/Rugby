import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { todayISO } from "../lib/metrics.js";
import { uniqueTopic } from "./messages.js";

/* Encouragements entre coéquipiers (SOCIAL, aucun point). Écriture via la RPC
   kudos_send (contrôle + notification). Lecture sous RLS club. `set` = totems
   que J'AI déjà encouragés aujourd'hui (plafond 1/jour/paire). */
export function useMyKudosToday(playerId) {
  const [set, setSet] = useState(() => new Set());

  const fetch = useCallback(async () => {
    if (!playerId) { setSet(new Set()); return; }
    const { data, error } = await supabase
      .from("activity_reactions").select("to_player")
      .eq("from_player", playerId).eq("day", todayISO());
    if (error) { console.error("[kudos]", error.message); return; }
    setSet(new Set((data ?? []).map((r) => r.to_player)));
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase.channel(uniqueTopic(`kudos:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_reactions", filter: `from_player=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  const send = useCallback(async (toPlayer) => {
    if (!toPlayer) return;
    setSet((s) => new Set(s).add(toPlayer)); // optimiste
    const { error } = await supabase.rpc("kudos_send", { p_to: toPlayer });
    if (error) { console.error("[kudos_send]", error.message); await fetch(); }
  }, [fetch]);

  return { set, send, refresh: fetch };
}
