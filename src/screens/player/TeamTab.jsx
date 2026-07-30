import Classement from "../shared/Classement.jsx";
import TeamWall from "./TeamWall.jsx";

/* Onglet « Équipe » (joueur) — vie du club. Bloc 1 : mur d'activité
   pseudonymisé (faits d'activité, aucune donnée de santé). Bloc 2 : le
   classement existant, réutilisé tel quel. */
export default function TeamTab({ me, teamId, players, sessions, logs, activities, bilans, crews, testCampaigns, testResults, accent }) {
  return (
    <div>
      <TeamWall teamId={teamId} players={players} accent={accent} />
      <Classement
        players={players} sessions={sessions} logs={logs} activities={activities}
        bilans={bilans} crews={crews} testCampaigns={testCampaigns} testResults={testResults}
        me={me} accent={accent}
      />
    </div>
  );
}
