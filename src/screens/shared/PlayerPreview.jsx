import { C } from "../../lib/tokens.js";
import PlayerApp from "../player/PlayerApp.jsx";

/* Bandeau « Mode aperçu joueur » + espace joueur rendu en LECTURE SEULE.
   Réutilisé par l'owner ET le staff pour ouvrir l'expérience d'un joueur (réel
   ou démo) telle qu'il la voit, sans se déconnecter. `preview` désactive toutes
   les écritures (cf. usePreview). Retour à la vue d'origine en un clic. */
export default function PlayerPreview({ profile, teamId, playerId, playerName, onExit }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: `${C.viol}22`, borderBottom: `1px solid ${C.viol}55` }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.viol }}>
          👁 MODE APERÇU JOUEUR{playerName ? ` · ${playerName}` : ""} · lecture seule
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onExit} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
      </div>
      <PlayerApp key={playerId} preview profile={{ ...profile, role: "joueur", team_id: teamId, player_id: playerId }} />
    </div>
  );
}
