import Fiche from "../shared/Fiche.jsx";

/* Onglet « Moi » (joueur) — profil du joueur. Bloc 1 (à venir, PR-E) :
   division (Bronze→Élite, calculée sur computePoints) + badges dérivés de notre
   barème existant. Bloc 2 : la fiche joueur existante (identité pseudonymisée,
   KPIs, records). Point d'accroche unique : PR-E insérera l'en-tête division +
   badges au-dessus de la fiche sans rien retirer. */
export default function Profile({ me }) {
  return (
    <div>
      {/* PR-E : <ProfileBadges me={me} sessions={...} logs={...} accent={accent} /> */}
      <Fiche player={me} canEdit={false} self />
    </div>
  );
}
