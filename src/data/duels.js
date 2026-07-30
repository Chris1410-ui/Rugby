import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Duels 1-contre-1 (onglet Équipe). Table `duels` en lecture seule (RLS
   participants + staff) ; toutes les transitions passent par des RPC SECURITY
   DEFINER (migration 0120). Le score est un décompte de faits déjà comptés
   (séances validées) — aucune monnaie parallèle. */

// Duels où je suis impliqué (challenger ou opponent), les plus récents d'abord.
export function useMyDuels(playerId) {
  const [duels, setDuels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setDuels([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("duels")
      .select("*")
      .or(`challenger_id.eq.${playerId},opponent_id.eq.${playerId}`)
      .order("created_at", { ascending: false });
    if (error) { console.error("[duels]", error.message); setLoading(false); return; }
    setDuels(data ?? []);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase
      .channel(uniqueTopic(`duels:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  return { duels, loading, refresh: fetch };
}

export async function createDuel(opponentId, days = 7) {
  const { data, error } = await supabase.rpc("duel_create", { p_opponent: opponentId, p_days: days });
  if (error) throw error;
  return data;
}

export async function respondDuel(duelId, accept) {
  const { error } = await supabase.rpc("duel_respond", { p_duel: duelId, p_accept: accept });
  if (error) throw error;
}

export async function cancelDuel(duelId) {
  const { error } = await supabase.rpc("duel_cancel", { p_duel: duelId });
  if (error) throw error;
}

// Score en direct d'un duel (RPC) → { challengerN, opponentN, endsAt, isOver, winnerId }.
export async function fetchDuelStanding(duelId) {
  const { data, error } = await supabase.rpc("duel_standing", { p_duel: duelId });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    challengerN: r.challenger_n ?? 0,
    opponentN: r.opponent_n ?? 0,
    startsAt: r.starts_at ?? null,
    endsAt: r.ends_at ?? null,
    status: r.status ?? null,
    isOver: !!r.is_over,
    winnerId: r.winner_id ?? null,
  };
}
