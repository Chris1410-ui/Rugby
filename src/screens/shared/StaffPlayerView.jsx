import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, CODES, sc, sessionCodeLabel } from "../../lib/tokens.js";
import { Tag, NatureTag, CloseX, useModalClose } from "../../lib/ui.jsx";
import { CheckCircle, ChevronDown, ExternalLink } from "../../lib/icons.jsx";
import { localeTag } from "../../i18n/locale.js";
import { displayName } from "../../lib/identity.js";
import { parseISO, todayISO, statusOfLog, sessionDisplayState, cmpDate } from "../../lib/metrics.js";
import { PreviewContext } from "../../lib/preview.js";
import { useMyDay } from "../../data/checkins.js";
import { useTeamSessions } from "../../data/sessions.js";
import { useTeamLogs } from "../../data/logs.js";
import Fiche from "./Fiche.jsx";
import Player1RM from "./Player1RM.jsx";
import TestsEvolution from "./TestsEvolution.jsx";
import SessionPlayCard from "../player/SessionPlayCard.jsx";
import MorningForm from "../player/bilan/MorningForm.jsx";
import EveningForm from "../player/bilan/EveningForm.jsx";
import ActivitiesForm from "../player/bilan/ActivitiesForm.jsx";

const ACCENT = C.viol;
const STATE_COLOR = { done: C.green, missed: C.coral, todo: C.amb, postponed: C.gray };

/* Vue joueur COMPLÈTE côté staff/owner (point d'entrée : liste Joueurs). Réunit,
   en onglets pour éviter un écran interminable : Aujourd'hui (bilans du jour) ·
   Fiche (toutes les infos) · Séances (liste + détail au clic) · Tests/1RM. Réutilise
   les composants existants ; l'espace joueur embarqué (bilans, détail de séance) est
   rendu en LECTURE SEULE via PreviewContext — aucune écriture sous l'identité du
   joueur observé. Le staff n'édite QUE ce que la fiche l'autorise déjà (canEdit).
   Accès défensifs : chaque onglet gère joueur sans bilan / séance / test / 1RM. */
export default function StaffPlayerView({ player, players = [], canEdit = false, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const [tab, setTab] = useState("today");

  const tabs = [
    { key: "today", label: t("staffPlayer.tabToday") },
    { key: "fiche", label: t("staffPlayer.tabFiche") },
    { key: "sessions", label: t("staffPlayer.tabSessions") },
    { key: "tests", label: t("staffPlayer.tabTests") },
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3vh 12px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: C.panel, borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(player)}</div>
            {player?.initials && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{player.initials}</div>}
          </div>
          <CloseX onClose={onClose} />
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
          {tabs.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)} style={{ flex: "1 0 auto", padding: "8px 10px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${tab === x.key ? ACCENT : C.border}`, background: tab === x.key ? `${ACCENT}22` : "rgba(255,255,255,0.05)", color: tab === x.key ? "#fff" : "rgba(255,255,255,0.65)" }}>
              {x.label}
            </button>
          ))}
        </div>

        {tab === "today" && <TodayTab player={player} />}
        {tab === "fiche" && <Fiche player={player} players={players} canEdit={canEdit} hide={{ sessions: true }} />}
        {tab === "sessions" && <SessionsTab player={player} players={players} />}
        {tab === "tests" && (
          <div>
            <Player1RM player={player} canEdit={canEdit} />
            <TestsEvolution player={player} canEdit={canEdit} accent={ACCENT} />
          </div>
        )}
      </div>
    </div>
  );
}

/* Onglet AUJOURD'HUI — bilans du jour ☀️/🌙 en lecture seule (honnête : « pas encore
   encodé » si vide, détail sinon) + activités déclarées. Formules readiness/points
   inchangées (formulaires réutilisés en mode preview). */
function TodayTab({ player }) {
  const { t } = useTranslation();
  const { day, loading } = useMyDay(player?.id);
  if (loading) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: 8 }}>{t("staffPlayer.loading")}</div>;
  return (
    <div>
      <Moment emoji="☀️" label={t("staffPlayer.morning")} filled={!!day?.matin} t={t}
        form={<PreviewContext.Provider value={true}><MorningForm me={player} day={day} preview onSaved={() => {}} accent={ACCENT} /></PreviewContext.Provider>} />
      <Moment emoji="🌙" label={t("staffPlayer.evening")} filled={!!day?.soir} t={t}
        form={<PreviewContext.Provider value={true}><EveningForm me={player} day={day} preview onSaved={() => {}} accent={ACCENT} /></PreviewContext.Provider>} />
      <div style={sc({ padding: 12, marginTop: 4 })}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>{t("staffPlayer.activities")}</div>
        <PreviewContext.Provider value={true}><ActivitiesForm me={player} day={day} preview onSaved={() => {}} accent={ACCENT} /></PreviewContext.Provider>
      </div>
    </div>
  );
}

// Carte repliable d'un moment (matin/soir) : état honnête + détail au dépli.
function Moment({ emoji, label, filled, form, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={sc({ padding: 0, marginBottom: 10, overflow: "hidden" })}>
      <button onClick={() => filled && setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "none", border: "none", cursor: filled ? "pointer" : "default", color: "#fff" }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 800 }}>{label}</span>
        {filled
          ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.green }}><CheckCircle size={13} /> {t("staffPlayer.filled")}</span>
          : <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>{t("staffPlayer.notFilled")}</span>}
        {filled && <ChevronDown size={15} color="rgba(255,255,255,0.5)" style={{ transform: open ? "rotate(180deg)" : "none" }} />}
      </button>
      {filled && open && <div style={{ padding: "0 13px 13px" }}>{form}</div>}
    </div>
  );
}

/* Onglet SÉANCES — liste (récent d'abord) cliquable → détail complet en lecture
   seule (exercices prescrits, prescrit vs réalisé set-par-set, RPE, durée, notes,
   vidéo) via SessionPlayCard en PreviewContext. */
function SessionsTab({ player, players }) {
  const { t } = useTranslation();
  const { sessions } = useTeamSessions(player?.team, players);
  const { logs } = useTeamLogs(player?.team);
  const today = todayISO();
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => (sessions || [])
    .filter((s) => (s.assignedIds || []).includes(player?.id))
    .map((s) => ({ s, st: sessionDisplayState(statusOfLog(logs, s.id, player?.id), s.date, today), rpe: logs?.[s.id]?.[player?.id]?.rpe, dur: logs?.[s.id]?.[player?.id]?.duration }))
    .sort((a, b) => cmpDate(b.s?.date, a.s?.date)), [sessions, logs, player?.id, today]);

  if (rows.length === 0) return <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("staffPlayer.noSessions")}</div>;

  return (
    <div>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{t("staffPlayer.sessionsHint")}</div>
      {rows.map(({ s, st, rpe, dur }) => {
        const d = parseISO(s.date);
        return (
          <button key={s.id} onClick={() => setOpen(s)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", background: "none", border: "none", borderBottom: `1px solid ${C.border2}`, cursor: "pointer", color: "#fff", textAlign: "left" }}>
            <div style={{ textAlign: "center", width: 38, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString(localeTag(), { month: "short" })}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{d.getDate()}</div>
            </div>
            <div style={{ width: 3, height: 26, borderRadius: 2, background: STATE_COLOR[st], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                {s.code && <Tag c={CODES[s.code] || C.viol} title={sessionCodeLabel(t, s.code)}>{s.code}</Tag>}
                <NatureTag nature={s.nature} code={s.code} />
                <span style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.titre}</span>
              </div>
            </div>
            {st === "done" && dur > 0 && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{dur} {t("player.session.min")}</span>}
            {st === "done" ? <Tag c={C.green}>{t("shared.calendar.tagDone")}{rpe ? ` · ${t("shared.calendar.rpe", { rpe })}` : ""}</Tag>
              : st === "missed" ? <Tag c={C.coral}>{t("shared.calendar.tagMissed")}</Tag>
                : st === "postponed" ? <Tag c={C.gray}>{t("shared.calendar.tagPostponed")}</Tag>
                  : <Tag c={C.amb}>{t("shared.calendar.tagTodo")}</Tag>}
            <ExternalLink size={13} color="rgba(255,255,255,0.4)" />
          </button>
        );
      })}

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3vh 12px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><CloseX onClose={() => setOpen(null)} /></div>
            <PreviewContext.Provider value={true}>
              <SessionPlayCard s={open} me={player} log={logs?.[open.id]?.[player?.id]} sessions={sessions} logs={logs} accent={ACCENT} onSaved={() => {}} />
            </PreviewContext.Provider>
          </div>
        </div>
      )}
    </div>
  );
}
