import { C } from "../../lib/tokens.js";
import Fiche from "../shared/Fiche.jsx";
import ProfileBadges from "./ProfileBadges.jsx";

/* Onglet « Moi » (joueur) — profil du joueur. Bloc 1 : division (Bronze→Élite,
   calculée sur computePoints) + récompenses dérivées de notre barème existant.
   Bloc 2 : la fiche joueur existante (identité pseudonymisée, KPIs, records). */
export default function Profile({ me, teamId, sessions = [], accent = C.green }) {
  return (
    <div>
      <ProfileBadges me={me} teamId={teamId} sessions={sessions} accent={accent} />
      <Fiche player={me} canEdit={false} self />
    </div>
  );
}
