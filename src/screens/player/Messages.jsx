import { useTranslation } from "react-i18next";
import Conversation from "../shared/Conversation.jsx";
import { displayName } from "../../lib/identity.js";
/* Boîte de réception du joueur — fil unique avec le staff, affiché en plein
   (fil → saisie). Toujours possible d'écrire, même sans historique. */
export default function Messages({ me, accent }) {
  const { t } = useTranslation();
  return (
    <div style={{ height: "100%" }}>
      <Conversation playerId={me.id} title={t("player.messages.staffTitle")} who="joueur" selfName={displayName(me)} accent={accent} />
    </div>
  );
}
