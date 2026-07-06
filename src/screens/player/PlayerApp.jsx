import { useState } from "react";
import { C } from "../../lib/tokens.js";
import { sc } from "../../lib/tokens.js";
import { useTeamData } from "../../data/useTeamData.js";
import { BottomNav } from "../../lib/ui.jsx";
import { Sun, Dumbbell } from "../../lib/icons.jsx";
import Bilan from "./Bilan.jsx";
import Seances from "./Seances.jsx";

const ACCENT = C.green;

/* Espace joueur. Toutes les données viennent de useTeamData → enrichPlayers
   (une seule dérivation ; aucun recalcul écran par écran). RLS limite l'effectif
   au joueur lui-même. */
export default function PlayerApp({ profile }) {
  const [tab, setTab] = useState("bilan");
  const { players, sessions, logs, loading } = useTeamData(profile.team_id);
  const me = players.find((p) => p.id === profile.player_id) || players[0];

  if (loading && !me) {
    return <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Chargement…</div>;
  }
  if (!me) {
    return (
      <div style={{ padding: 18 }}>
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.5)", fontSize: 12 })}>
          Ton profil joueur n'est pas encore lié à l'effectif. Contacte le staff.
        </div>
      </div>
    );
  }

  const nav = [
    ["bilan", "Mon bilan", Sun],
    ["seances", "Mes séances", Dumbbell],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <main style={{ flex: 1, padding: 18 }}>
        {tab === "bilan" && <Bilan me={me} accent={ACCENT} />}
        {tab === "seances" && <Seances me={me} sessions={sessions} logs={logs} accent={ACCENT} />}
      </main>
      <BottomNav items={nav} active={tab} onSelect={setTab} accent={ACCENT} />
    </div>
  );
}
