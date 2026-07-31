import { useMemo } from "react";
import { computePoints, divOf, nextDiv } from "../lib/metrics.js";
import { bilanEventsOf } from "./checkins.js";
import { useTeamTop14 } from "./tests.js";
import { useTeamTaskPoints } from "./tasks.js";
import { useTeamChallengePoints } from "./challenges.js";
import { useTeamReactivity } from "./notifications.js";
import { useTeamTrainingEvents } from "./trainings.js";
import { useTeamSessionLogs, useTeamCheckinEvents, useTeamGpsEvents } from "./leaderboard.js";
import { useTeamRoutinePoints } from "./morningRoutine.js";
import { useTeamStreakTiers } from "./streak.js";
import { useTeamWeeklyMission } from "./weeklyMission.js";

/* Standing (points + division) du joueur connecté — MÊME source que le
   classement : `computePoints` alimenté par les RPC de faits À L'ÉCHELLE DU CLUB
   (SECURITY DEFINER), pas par les données limitées par la RLS du joueur.
   Aucune formule modifiée, aucune monnaie parallèle : on lit le barème existant
   pour un seul joueur (l'onglet « Moi »). */
/* Classement du club (points par joueur, tri décroissant) — MÊMES entrées que
   l'écran Classement/usePlayerStanding, calculé pour TOUS les joueurs. Sert le
   « rang + écart avec le joueur devant » du bloc « Le groupe aujourd'hui ».
   Retourne { list:[{id,pts}], rankById:{id:rang(1-based)} }. Aucune formule
   modifiée ; lit le barème existant. */
export function useClubLeaderboard(teamId, players = [], sessions = []) {
  const top14 = useTeamTop14(teamId);
  const taskPts = useTeamTaskPoints(teamId);
  const chalPts = useTeamChallengePoints(teamId);
  const react = useTeamReactivity(teamId);
  const { byPlayer: conv } = useTeamTrainingEvents(teamId);
  const routine = useTeamRoutinePoints(teamId);
  const { byPlayer: gps } = useTeamGpsEvents(teamId);
  const { byPlayer: tiers } = useTeamStreakTiers(teamId);
  const { byPlayer: mission } = useTeamWeeklyMission(teamId);
  const clubLogs = useTeamSessionLogs(teamId);
  const { activities: clubActivities, bilans: clubBilans } = useTeamCheckinEvents(teamId);

  return useMemo(() => {
    const list = (players || []).map((p) => {
      const events = top14[p.id] || [];
      const taskEvents = (taskPts[p.id] || []).map((t) => ({ label: t.titre, date: t.date }));
      const bilanEvents = bilanEventsOf(clubBilans[p.id]);
      const challengeEvents = (chalPts[p.id] || []).map((c) => ({ label: c.titre, points: c.points, date: c.date }));
      const res = computePoints(p, sessions, clubLogs, clubActivities[p.id], events, taskEvents, react[p.id] || [], bilanEvents, challengeEvents, conv[p.id] || [], routine[p.id] || [], gps[p.id] || [], tiers[p.id] || [], mission[p.id] || []);
      return { id: p.id, pts: res.pts };
    }).sort((a, b) => b.pts - a.pts || String(a.id).localeCompare(String(b.id)));
    const rankById = {};
    list.forEach((r, i) => { rankById[r.id] = i + 1; });
    return { list, rankById };
  }, [players, sessions, clubLogs, clubActivities, clubBilans, top14, taskPts, chalPts, react, conv, routine, gps, tiers, mission]);
}

export function usePlayerStanding(teamId, me, sessions = []) {
  const top14 = useTeamTop14(teamId);
  const taskPts = useTeamTaskPoints(teamId);
  const chalPts = useTeamChallengePoints(teamId);
  const react = useTeamReactivity(teamId);
  const { byPlayer: conv } = useTeamTrainingEvents(teamId);
  const routine = useTeamRoutinePoints(teamId);
  const { byPlayer: gps } = useTeamGpsEvents(teamId);
  const { byPlayer: tiers } = useTeamStreakTiers(teamId);
  const { byPlayer: mission } = useTeamWeeklyMission(teamId);
  const clubLogs = useTeamSessionLogs(teamId);
  const { activities: clubActivities, bilans: clubBilans } = useTeamCheckinEvents(teamId);

  return useMemo(() => {
    if (!me) return null;
    const events = top14[me.id] || [];
    const taskEvents = (taskPts[me.id] || []).map((t) => ({ label: t.titre, date: t.date }));
    const reactEvents = react[me.id] || [];
    const bilanEvents = bilanEventsOf(clubBilans[me.id]);
    const cp = chalPts[me.id] || [];
    const challengeEvents = cp.map((c) => ({ label: c.titre, points: c.points, date: c.date }));
    const convocationEvents = conv[me.id] || [];
    const routineEvents = routine[me.id] || [];
    const gpsEvents = gps[me.id] || [];
    const streakTierEvents = tiers[me.id] || [];
    const res = computePoints(me, sessions, clubLogs, clubActivities[me.id], events, taskEvents, reactEvents, bilanEvents, challengeEvents, convocationEvents, routineEvents, gpsEvents, streakTierEvents, mission[me.id] || []);
    return { ...res, div: divOf(res.pts), next: nextDiv(res.pts), gpsCount: gpsEvents.length };
  }, [me, sessions, clubLogs, clubActivities, clubBilans, top14, taskPts, chalPts, react, conv, routine, gps, tiers, mission]);
}
