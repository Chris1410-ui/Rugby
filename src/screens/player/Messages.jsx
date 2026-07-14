import Conversation from "../shared/Conversation.jsx";

/* Boîte de réception du joueur — fil unique avec le staff, affiché en plein
   (fil → saisie). Toujours possible d'écrire, même sans historique. */
export default function Messages({ me, accent }) {
  return (
    <div style={{ height: "100%" }}>
      <Conversation playerId={me.id} title="Staff — Préparateur physique" who="joueur" selfName={me.name} accent={accent} />
    </div>
  );
}
