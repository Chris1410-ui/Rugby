import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useLocalToday } from "../lib/useLocalToday.js";
import { uniqueTopic } from "./messages.js";

/* Série (streak) + gel de série — écran Aujourd'hui, refonte Open Design.

   « Jour validé » = bilan du matin fait. Une nuit gelée protège la série. Tout
   est DÉRIVÉ côté base par la RPC SECURITY DEFINER `streak_sync` (0121) : le
   nombre de jours n'est jamais stocké, seul le ledger des gels l'est. La RPC
   crédite aussi paresseusement le gel mensuel (1/mois, plafond 2).

   La date « aujourd'hui » est LOCALE au joueur (comme daily_checkins) → on la
   passe explicitement pour rester aligné sur le reset minuit local (lot 1). */
export function useStreak(playerId) {
  const today = useLocalToday();
  const [state, setState] = useState({ streak: 0, best: 0, freezesAvailable: 0, frozenTonight: false });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setLoading(false); return; }
    const { data, error } = await supabase.rpc("streak_sync", { p_today: today });
    if (error) { console.error("[streak_sync]", error.message); setLoading(false); return; }
    const r = (data && data[0]) || {};
    setState({
      streak: r.streak ?? 0,
      best: r.best ?? 0,
      freezesAvailable: r.freezes_available ?? 0,
      frozenTonight: !!r.frozen_tonight,
    });
    setLoading(false);
  }, [playerId, today]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase
      .channel(uniqueTopic(`streak:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins", filter: `player_id=eq.${playerId}` }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "streak_freezes", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  return { ...state, loading, refresh: fetch };
}

/* Consommer un gel pour protéger la nuit `night` (date locale, défaut =
   aujourd'hui). Les garde-fous (stock, fenêtre ±1 j, jour déjà validé) sont
   appliqués côté RPC ; on remonte le code d'erreur pour l'UI. */
export async function freezeNight(night) {
  const { error } = await supabase.rpc("streak_freeze_use", night ? { p_night: night } : {});
  if (error) throw error;
}

/* Events « palier de série atteint » de TOUT le club (points additifs 7/14/30,
   cf. computePoints). RPC SECURITY DEFINER team_streak_tier_events (0122) :
   n'expose que (player_id, tier, reached_on), jamais la longueur courante ni de
   donnée de santé. → { [playerId]: [{ tier, date }] }. Même modèle que les
   autres RPC de faits d'équipe (0036/0114). */
export function useTeamStreakTiers(teamId) {
  const [byPlayer, setByPlayer] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_streak_tier_events", { p_team: teamId });
    if (error) { console.error("[team_streak_tier_events]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ tier: r.tier, date: r.reached_on }); });
    setByPlayer(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`lb-tiers:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "streak_tier_events" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return { byPlayer, refresh: fetch };
}
