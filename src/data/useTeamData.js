import { useCallback, useMemo } from "react";
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
  const { players: roster, loading: rosterLoading, refresh: refreshRoster } = useRoster(teamId);
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useTeamSessions(teamId, roster);
  const { logs, refresh: refreshLogs } = useTeamLogs(teamId);

  const playerIds = useMemo(() => roster.map((p) => p.id), [roster]);
  const { checkins, activities, bilans, refresh: refreshCheckins } = useTeamCheckins(playerIds);
  const { crews, refresh: refreshCrews } = useCrews(teamId);
  const { campaigns: testCampaigns, results: testResults, refresh: refreshTests } = useTestCampaigns(teamId);

  const players = useMemo(
    () => enrichPlayers(roster, sessions, logs, checkins),
    [roster, sessions, logs, checkins]
  );

  // Re-fetch manuel (pull-to-refresh). Les données sont déjà tenues à jour en
  // temps réel ; ceci force une resynchro à la demande de l'utilisateur.
  const refresh = useCallback(async () => {
    await Promise.all(
      [refreshRoster, refreshSessions, refreshLogs, refreshCheckins, refreshCrews, refreshTests]
        .filter(Boolean).map((fn) => { try { return fn(); } catch { return null; } })
    );
  }, [refreshRoster, refreshSessions, refreshLogs, refreshCheckins, refreshCrews, refreshTests]);

  return {
    refresh,
    players, // effectif enrichi (ACWR, wellness, readiness, risque, charge…)
    roster, // effectif brut
    sessions,
    logs,
    checkins,
    activities, // historique d'activités déclarées par joueur (points #6)
    bilans, // bilans complétés par joueur { pid: [{date, moment}] } (points +10)
    crews, // équipes formées par les joueurs (classement par équipe)
    testCampaigns, // campagnes de tests (pour la comparaison / points Top 14)
    testResults,
    loading: rosterLoading || sessionsLoading,
  };
}
