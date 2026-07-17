import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Entrées de points du CLASSEMENT, vues à l'échelle du CLUB (identiques pour
   owner / staff / joueur). Sans ces RPC, un joueur ne lisait (RLS) que ses
   propres session_logs / daily_checkins → il calculait de faux points pour ses
   coéquipiers. Les RPC SECURITY DEFINER (migration 0036) exposent uniquement le
   sous-ensemble « points » — jamais les valeurs de bien-être / RPE. */

// Lignes team_session_logs → { [sessionId]: { [playerId]: { status, perExercise } } }
// (forme attendue par computePoints ; `filled` reconstitue un perExercise minimal).
export function logsFromRows(rows = []) {
  const out = {};
  rows.forEach((r) => {
    (out[r.session_id] = out[r.session_id] || {})[r.player_id] = {
      status: r.status,
      perExercise: r.filled ? { _: { reps: 1 } } : {},
    };
  });
  return out;
}

// Lignes team_checkin_events → { activities: {pid:[{date,activities}]},
//                                bilans:     {pid:[{date,moment}]} }
export function checkinMapsFromRows(rows = []) {
  const activities = {};
  const bilans = {};
  rows.forEach((r) => {
    const date = r.checkin_date;
    const moment = r.moment || "matin";
    if (Array.isArray(r.activities) && r.activities.length) {
      (activities[r.player_id] = activities[r.player_id] || []).push({ date, activities: r.activities });
    }
    (bilans[r.player_id] = bilans[r.player_id] || []).push({ date, moment });
  });
  return { activities, bilans };
}

/* Logs de séances de TOUT le club (statut + « valeurs renseignées »). */
export function useTeamSessionLogs(teamId) {
  const [logs, setLogs] = useState({});
  const fetch = useCallback(async () => {
    if (!teamId) { setLogs({}); return; }
    const { data, error } = await supabase.rpc("team_session_logs", { p_team: teamId });
    if (error) { console.error("[team_session_logs]", error.message); return; }
    setLogs(logsFromRows(data ?? []));
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`lb-logs:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return logs;
}

/* Activités déclarées + bilans complétés de TOUT le club. */
export function useTeamCheckinEvents(teamId) {
  const [maps, setMaps] = useState({ activities: {}, bilans: {} });
  const fetch = useCallback(async () => {
    if (!teamId) { setMaps({ activities: {}, bilans: {} }); return; }
    const { data, error } = await supabase.rpc("team_checkin_events", { p_team: teamId });
    if (error) { console.error("[team_checkin_events]", error.message); return; }
    setMaps(checkinMapsFromRows(data ?? []));
  }, [teamId]);
  useEffect(() => {
    fetch(); if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`lb-checkins:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);
  return maps;
}
