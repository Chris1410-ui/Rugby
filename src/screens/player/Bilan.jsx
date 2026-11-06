import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { Overlay } from "../../lib/ui.jsx";
import { useMyDay, usePlayerCheckins } from "../../data/checkins.js";
import { usePreview } from "../../lib/preview.js";
import AccueilHero from "./accueil/AccueilHero.jsx";
import AccueilMission from "./accueil/AccueilMission.jsx";
import QuickCheckin from "./bilan/QuickCheckin.jsx";
import MorningForm from "./bilan/MorningForm.jsx";
import EveningForm from "./bilan/EveningForm.jsx";
import SessionLive from "./SessionLive.jsx";

/* Écran « Bilan » (joueur) — version simplifiée : uniquement le questionnaire
   du jour. On garde l'essentiel pour que le joueur réponde vite :
   - l'en-tête (totem + date + poste) ;
   - le bloc « Ce qu'il te reste » (matin · séance · soir) qui pilote la saisie ;
   - le check-in du matin par glissement (geste rapide) ;
   - les feuilles questionnaire matin / soir et le lancement de séance.
   Formules readiness/points INCHANGÉES (on n'affiche plus les dérivés ici, on
   ne les modifie pas). Les écrans secondaires restent dans le code mais sont
   masqués de la navigation (cf. PlayerApp). */
export default function Bilan({ me, accent = C.green, sessions = [], logs = {}, onNavigate }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const { day, refresh } = useMyDay(me.id);
  const [sheet, setSheet] = useState(null);            // morning | evening
  const [liveSession, setLiveSession] = useState(null); // séance ouverte en mode live
  const { checkins } = usePlayerCheckins(me.id, 21);
  const today = todayISO();

  // Séances assignées aujourd'hui (pour le bloc mission + le lancement de séance).
  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === today && (s.assignedIds || []).includes(me.id)),
    [sessions, today, me.id],
  );

  const onSaved = () => refresh();
  const closeSheet = () => setSheet(null);

  return (
    <div>
      {/* Hero : totem + date + poste/ligne/club. */}
      <AccueilHero me={me} today={today} />

      {/* Bloc dominant « Ce qu'il te reste » : matin · séance · soir. */}
      <AccueilMission me={me} day={day} todaySessions={todaySessions} logs={logs} accent={C.coral}
        onMorning={() => setSheet("morning")} onSession={(s) => setLiveSession(s)} onEvening={() => setSheet("evening")} />

      {/* Check-in du matin par glissement — le geste rapide qui débloque la saisie. */}
      <QuickCheckin me={me} accent={accent} day={day} checkins={checkins} today={today} preview={preview} onSaved={onSaved} onDetail={() => setSheet("morning")} />

      {/* ── Feuilles (bottom-sheets) : questionnaire matin / soir ── */}
      {sheet === "morning" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.bilan.morning")} t={t} /><div style={{ padding: "0 18px 22px" }}><MorningForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {sheet === "evening" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.bilan.evening")} t={t} /><div style={{ padding: "0 18px 22px" }}><EveningForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}

      {/* Lancement d'une séance assignée (mode live, logging set par set). */}
      {liveSession && (
        <SessionLive s={liveSession} me={me} sessions={sessions} logs={logs} log={logs?.[liveSession.id]?.[me.id]}
          accent={accent} onClose={() => setLiveSession(null)} onSaved={refresh} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function SheetHead({ title, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "4px 18px 12px" }}>
      <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{title}</div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t("player.today.swipeClose")}</span>
    </div>
  );
}
