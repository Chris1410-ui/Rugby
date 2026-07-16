import { useMemo } from "react";
import { useRoster } from "./players.js";
import { useTeamSessions } from "./sessions.js";
import { useTeamLogs } from "./logs.js";
import { useTeamCheckins } from "./checkins.js";
import { useCrews } from "./crews.js";
import { useTestCampaigns } from "./tests.js";
import { enrichPlayers } from "../lib/metrics.js";

/* SOURCE DE VÉRITÉ UNIQUE côté client (MIGRATION §5).
   Agrège effectif + séances + logs + bilans (tous scoprés par RLS) et dérive
   l'effectif enrichi via enrichPlayers. Tous les écrans lisent `players`. */
export function useTeamData(teamId) {
  const { players: roster, loading: rosterLoading } = useRoster(teamId);
  const { sessions, loading: sessionsLoading } = useTeamSessions(teamId, roster);
  const { logs } = useTeamLogs(teamId);

  const playerIds = useMemo(() => roster.map((p) => p.id), [roster]);
  const { checkins, activities } = useTeamCheckins(playerIds);
  const { crews } = useCrews(teamId);
  const { campaigns: testCampaigns, results: testResults } = useTestCampaigns(teamId);

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
    activities, // historique d'activités déclarées par joueur (points #6)
    crews, // équipes formées par les joueurs (classement par équipe)
    testCampaigns, // campagnes de tests (pour la comparaison / points Top 14)
    testResults,
    loading: rosterLoading || sessionsLoading,
  };
}
