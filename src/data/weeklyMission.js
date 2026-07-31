import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Mission hebdo (objectif « 3 jours » existant) → points additifs 1×/semaine ISO.
   `syncWeeklyMission` crédite paresseusement côté base (self-check) au chargement
   du joueur ; `useTeamWeeklyMission` lit les faits du club pour le classement
   (RPC SECURITY DEFINER, jamais de donnée de santé). Même motif que les paliers
   de série — aucune formule modifiée. */

export async function syncWeeklyMission() {
  const { error } = await supabase.rpc("weekly_mission_sync", {});
  if (error) console.error("[weekly_mission_sync]", error.message);
}

export function useTeamWeeklyMission(teamId) {
  const [byPlayer, setByPlayer] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_weekly_mission_events", { p_team: teamId });
    if (error) { console.error("[team_weekly_mission]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ date: r.reached_on }); });
    setByPlayer(m);
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`lb-mission:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_mission_events" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return { byPlayer, refresh: fetch };
}
