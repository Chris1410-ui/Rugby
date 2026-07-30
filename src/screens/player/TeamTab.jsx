import Classement from "../shared/Classement.jsx";

/* Onglet « Équipe » (joueur) — vie du club. Bloc 1 (à venir, PR-C) : mur
   d'activité pseudonymisé. Bloc 2 : le classement existant, réutilisé tel quel.
   Ce conteneur est le point d'accroche unique : PR-C insérera <TeamWall/>
   au-dessus du classement sans toucher au reste. */
export default function TeamTab({ me, players, sessions, logs, activities, bilans, crews, testCampaigns, testResults, accent }) {
  return (
    <div>
      {/* PR-C : <TeamWall teamId={teamId} me={me} players={players} accent={accent} /> */}
      <Classement
        players={players} sessions={sessions} logs={logs} activities={activities}
        bilans={bilans} crews={crews} testCampaigns={testCampaigns} testResults={testResults}
        me={me} accent={accent}
      />
    </div>
  );
}
