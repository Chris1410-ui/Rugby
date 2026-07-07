import { useState } from "react";
import { C } from "../../lib/tokens.js";
import { sc } from "../../lib/tokens.js";
import { useTeamData } from "../../data/useTeamData.js";
import { useThread } from "../../data/messages.js";
import { BottomNav } from "../../lib/ui.jsx";
import { Sun, Dumbbell, MessageSquare, Trophy, Calendar, Shield, Activity } from "../../lib/icons.jsx";
import Bilan from "./Bilan.jsx";
import Seances from "./Seances.jsx";
import Messages from "./Messages.jsx";
import Comparaison from "./Comparaison.jsx";
import Classement from "../shared/Classement.jsx";
import Calendrier from "../shared/Calendrier.jsx";
import Fiche from "../shared/Fiche.jsx";

const ACCENT = C.green;

/* Espace joueur. Toutes les données viennent de useTeamData → enrichPlayers
   (une seule dérivation ; aucun recalcul écran par écran). RLS limite l'effectif
   au joueur lui-même. */
export default function PlayerApp({ profile }) {
  const [tab, setTab] = useState("bilan");
  const { players, sessions, logs, loading } = useTeamData(profile.team_id);
  const me = players.find((p) => p.id === profile.player_id) || players[0];
  const { msgs } = useThread(me?.id);
  const unread = msgs.filter((m) => m.dir === "staff" && !m.read).length;

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
    ["messages", "Messages", MessageSquare, unread],
    ["classement", "Classement", Trophy],
    ["calendrier", "Calendrier", Calendar],
    ["fiche", "Ma fiche", Shield],
    ["comparaison", "Comparaison", Activity],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <main style={{ flex: 1, padding: 18 }}>
        {tab === "bilan" && <Bilan me={me} accent={ACCENT} />}
        {tab === "seances" && <Seances me={me} sessions={sessions} logs={logs} accent={ACCENT} />}
        {tab === "messages" && <Messages me={me} accent={ACCENT} />}
        {tab === "classement" && <Classement players={players} sessions={sessions} logs={logs} me={me} accent={ACCENT} />}
        {tab === "calendrier" && <Calendrier sessions={sessions} logs={logs} meId={me.id} accent={ACCENT} />}
        {tab === "fiche" && <Fiche player={me} canEdit={false} />}
        {tab === "comparaison" && <Comparaison me={me} players={players} accent={ACCENT} />}
      </main>
      <BottomNav items={nav} active={tab} onSelect={setTab} accent={ACCENT} />
    </div>
  );
}
