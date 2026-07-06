import { useMemo } from "react";
import { useRoster } from "./players.js";
import { useTeamSessions } from "./sessions.js";
import { useTeamLogs } from "./logs.js";
import { useTeamCheckins } from "./checkins.js";
import { enrichPlayers } from "../lib/metrics.js";

/* SOURCE DE VÉRITÉ UNIQUE côté client (MIGRATION §5).
   Agrège effectif + séances + logs + bilans (tous scoprés par RLS) et dérive
   l'effectif enrichi via enrichPlayers. Tous les écrans lisent `players`. */
export function useTeamData(teamId) {
  const { players: roster, loading: rosterLoading } = useRoster(teamId);
  const { sessions, loading: sessionsLoading } = useTeamSessions(teamId, roster);
  const { logs } = useTeamLogs(teamId);

  const playerIds = useMemo(() => roster.map((p) => p.id), [roster]);
  const { checkins } = useTeamCheckins(playerIds);

  const players = useMemo(
    () => enrichPlayers(roster, sessions, logs, checkins),
    [roster, sessions, logs, checkins]
  );

  return {
    players, // effectif enrichi (ACWR, wellness, readiness, risque, charge…)
    roster, // effectif brut
    sessions,
    logs,
    checkins,
    loading: rosterLoading || sessionsLoading,
  };
}
