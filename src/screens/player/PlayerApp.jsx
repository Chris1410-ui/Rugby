import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { sc } from "../../lib/tokens.js";
import { useTeamData } from "../../data/useTeamData.js";
import { useThread } from "../../data/messages.js";
import { useMyQuestionnaires } from "../../data/questionnaires.js";
import { useTeamTasks, useMyTaskCompletions } from "../../data/tasks.js";
import { useTeamChallenges, useMyChallengeCompletions } from "../../data/challenges.js";
import { useMyDay } from "../../data/checkins.js";
import { playerSessionTodo, playerTaskTodo, questionnaireTodo, bilanTodo, playerChallengeTodo } from "../../lib/badges.js";
import { useLocalToday } from "../../lib/useLocalToday.js";
import { PreviewContext } from "../../lib/preview.js";
import { BottomNav, MobileNav } from "../../lib/ui.jsx";
import { useIsMobile } from "../../lib/useIsMobile.js";
import PullToRefresh from "../../lib/pullToRefresh.jsx";
import { Sun, Dumbbell, MessageSquare, Trophy, Calendar, Shield, Activity, Lock, Users, ClipboardList, FileText, Film, Flame, Plus, Sparkles, Grid } from "../../lib/icons.jsx";
import Bilan from "./Bilan.jsx";
import Taches from "./Taches.jsx";
import Questionnaires from "./Questionnaires.jsx";
import Seances from "./Seances.jsx";
import Messages from "./Messages.jsx";
import Comparaison from "./Comparaison.jsx";
import Crew from "./Crew.jsx";
import Defis from "./Defis.jsx";
import Meditation from "./meditation/Meditation.jsx";
import Mediatheque from "../shared/Mediatheque.jsx";
import Classement from "../shared/Classement.jsx";
import Calendrier from "../shared/Calendrier.jsx";
import Fiche from "../shared/Fiche.jsx";
import Confidentialite from "../shared/Confidentialite.jsx";
import ExerciseLibrary from "../shared/ExerciseLibrary.jsx";
import PlayerProtocols from "./PlayerProtocols.jsx";

const ACCENT = C.green;

/* Espace joueur. Toutes les données viennent de useTeamData → enrichPlayers
   (une seule dérivation ; aucun recalcul écran par écran). RLS limite l'effectif
   au joueur lui-même. */
export default function PlayerApp({ profile, preview = false, tab: tabProp, onTab }) {
  const { t } = useTranslation();
  const [tabState, setTabState] = useState("bilan");
  const tab = tabProp ?? tabState;         // onglet piloté par AppShell (cloche/nav) ou interne (aperçu)
  const setTab = onTab || setTabState;
  const today = useLocalToday(); // reset du bilan du jour à minuit local
  const { players, sessions, logs, activities, bilans, crews, testCampaigns, testResults, loading, refresh } = useTeamData(profile.team_id);
  const me = players.find((p) => p.id === profile.player_id) || players[0];
  const { msgs } = useThread(me?.id);
  const unread = msgs.filter((m) => m.dir === "staff" && !m.read).length;
  // Pastilles = état réel en attente (pas le journal notifications), en direct.
  const { list: myQ } = useMyQuestionnaires(me?.id);
  const { tasks } = useTeamTasks(profile.team_id, players);
  const { statutByTask } = useMyTaskCompletions(me?.id);
  const { challenges } = useTeamChallenges(profile.team_id, players);
  const { statutByChallenge } = useMyChallengeCompletions(me?.id);
  const { day } = useMyDay(me?.id, today);
  const bSeances = playerSessionTodo(sessions, logs, me?.id, today);
  const bTaches = playerTaskTodo(tasks, statutByTask, me?.id);
  const bQuest = questionnaireTodo(myQ);
  const bBilan = bilanTodo(day);
  const bDefis = playerChallengeTodo(challenges, statutByChallenge, me?.id);
  const mobile = useIsMobile();

  if (loading && !me) {
    return <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{t("common.loading")}</div>;
  }
  if (!me) {
    return (
      <div style={{ padding: 18 }}>
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.5)", fontSize: 12 })}>
          {t("shell.playerNotLinked")}
        </div>
      </div>
    );
  }

  const nav = [
    ["bilan", t("nav.bilan"), Sun, bBilan],
    ["seances", t("nav.seances"), Dumbbell, bSeances],
    ["protocoles", t("nav.protocols"), FileText],
    ["taches", t("nav.taches"), ClipboardList, bTaches],
    ["defis", t("nav.defis"), Flame, bDefis],
    ["questionnaires", t("nav.questionnaires"), FileText, bQuest],
    ["messages", t("nav.messages"), MessageSquare, unread],
    ["equipe", t("nav.equipe"), Users],
    ["exercices", t("nav.exercices"), Grid],
    ["meditation", t("nav.meditation"), Sparkles],
    ["media", t("nav.media"), Film],
    ["classement", t("nav.classement"), Trophy],
    ["calendrier", t("nav.calendrier"), Calendar],
    ["fiche", t("nav.fiche"), Shield],
    ["comparaison", t("nav.comparaison"), Activity],
    ["donnees", t("nav.donnees"), Lock],
  ];

  return (
    <PreviewContext.Provider value={preview}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <main style={{ flex: 1, padding: 18 }}>
         <PullToRefresh onRefresh={refresh}>
          {tab === "bilan" && <Bilan key={today} me={me} accent={ACCENT} players={players} sessions={sessions} logs={logs} bilans={bilans} badges={{ defis: bDefis, taches: bTaches }} />}
          {tab === "seances" && <Seances me={me} sessions={sessions} logs={logs} teamId={profile.team_id} accent={ACCENT} />}
          {tab === "protocoles" && <PlayerProtocols teamId={profile.team_id} me={me} accent={ACCENT} />}
          {tab === "taches" && <Taches me={me} players={players} accent={ACCENT} />}
          {tab === "defis" && <Defis me={me} players={players} accent={ACCENT} />}
          {tab === "questionnaires" && <Questionnaires me={me} accent={ACCENT} />}
          {tab === "messages" && <Messages me={me} accent={ACCENT} />}
          {tab === "equipe" && <Crew me={me} teamId={profile.team_id} players={players} crews={crews} accent={ACCENT} />}
          {tab === "exercices" && <ExerciseLibrary />}
          {tab === "meditation" && <Meditation me={me} accent={ACCENT} />}
          {tab === "media" && <Mediatheque teamId={profile.team_id} canEdit={false} accent={ACCENT} />}
          {tab === "classement" && <Classement players={players} sessions={sessions} logs={logs} activities={activities} bilans={bilans} crews={crews} testCampaigns={testCampaigns} testResults={testResults} me={me} accent={ACCENT} />}
          {tab === "calendrier" && <Calendrier sessions={sessions} logs={logs} meId={me.id} accent={ACCENT} />}
          {tab === "fiche" && <Fiche player={me} canEdit={false} self />}
          {tab === "comparaison" && <Comparaison me={me} players={players} accent={ACCENT} />}
          {tab === "donnees" && <Confidentialite player={me} self />}
         </PullToRefresh>
        </main>
        {/* FAB « Déclarer une activité » sur Aujourd'hui (mobile, hors aperçu) */}
        {mobile && tab === "bilan" && !preview && (
          <button
            onClick={() => document.getElementById("activite-jour")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            title={t("player.activityFabTitle")}
            style={{ position: "fixed", right: 16, bottom: 76, zIndex: 25, background: ACCENT, border: "none", borderRadius: 24, padding: "12px 16px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}
          >
            <Plus size={16} /> {t("player.activityFab")}
          </button>
        )}
        {mobile
          ? <MobileNav items={nav} primary={["bilan", "seances", "classement", "messages"]} active={tab} onSelect={setTab} accent={ACCENT} />
          : <BottomNav items={nav} active={tab} onSelect={setTab} accent={ACCENT} />}
      </div>
    </PreviewContext.Provider>
  );
}
