import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { posDisplay } from "../../lib/positions.js";
import { wbToWellness, computeReadiness, statusOfLog, todayISO, isoDate, parseISO } from "../../lib/metrics.js";
import { Ring, Overlay } from "../../lib/ui.jsx";
import { ChevronRight, Check } from "../../lib/icons.jsx";
import { useMyDay } from "../../data/checkins.js";
import { usePreview } from "../../lib/preview.js";
import MorningForm from "./bilan/MorningForm.jsx";
import EveningForm from "./bilan/EveningForm.jsx";
import ActivitiesForm from "./bilan/ActivitiesForm.jsx";
import SessionPlayCard from "./SessionPlayCard.jsx";
import FreeSessionBuilder from "./FreeSessionBuilder.jsx";

/* Tableau de bord « Aujourd'hui » (joueur) — hub du jour : bandeau semaine
   (pastilles d'état par jour) + cartes d'action (bilans, séance, activités,
   défis/tâches). Tout se valide sur place en bottom-sheet, sans changer d'écran.
   Saisie du JOUR MÊME ; jours passés = lecture seule. Formules readiness/points
   INCHANGÉES (on réorganise l'accès, pas le calcul). */
export default function Bilan({ me, accent = C.green, sessions = [], logs = {}, bilans = {}, badges = {}, go }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const { day, refresh } = useMyDay(me.id);
  const [sheet, setSheet] = useState(null);   // morning | evening | activities | session
  const [daySel, setDaySel] = useState(null); // iso du jour ouvert en détail
  const [building, setBuilding] = useState(false);

  const today = todayISO();

  // Info d'un jour : séances assignées + statut, bilans matin/soir, complétude.
  const dayInfo = useMemo(() => (iso) => {
    const daySessions = sessions.filter((s) => s.date === iso && (s.assignedIds || []).includes(me.id));
    const done = daySessions.filter((s) => statusOfLog(logs, s.id, me.id) === "done").length;
    const moments = new Set((bilans[me.id] || []).filter((b) => b.date === iso).map((b) => b.moment));
    const hasM = moments.has("matin"), hasS = moments.has("soir");
    const sessionOK = daySessions.length === 0 || done === daySessions.length;
    const complete = hasM && hasS && sessionOK;
    const any = hasM || hasS || done > 0;
    return { daySessions, sessTotal: daySessions.length, sessDone: done, hasM, hasS, state: complete ? "done" : any ? "partial" : "none" };
  }, [sessions, logs, bilans, me.id]);

  // Bandeau semaine (lundi → dimanche autour d'aujourd'hui).
  const week = useMemo(() => {
    const b = parseISO(today); const dow = (b.getDay() + 6) % 7;
    const mon = new Date(b); mon.setDate(b.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const dt = new Date(mon); dt.setDate(mon.getDate() + i); return isoDate(dt); });
  }, [today]);

  const info = dayInfo(today);
  const readiness = day.matin
    ? computeReadiness(wbToWellness(day.matin.wb, day.matin.sleepH) || 0, me.risque, day.matin.sleepH)
    : (me.readiness || 0);

  const todaySessions = info.daySessions;
  const onSaved = () => refresh();
  const closeSheet = () => setSheet(null);

  const dstr = (iso, opts) => new Date(iso + "T00:00:00").toLocaleDateString(localeTag(), opts);

  return (
    <div>
      {/* En-tête : readiness + identité + date */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 14, padding: 16, marginBottom: 14 }}>
        <Ring val={readiness} max={100} color={readiness > 70 ? C.green : readiness > 50 ? C.amb : C.coral} label={t("player.bilan.readiness")} size={78} sw={6} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700 }}>
            {t("player.bilan.today")} · {dstr(today, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{displayName(me)}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{posDisplay(t, me.pos)}</div>
        </div>
      </div>

      {/* Bandeau semaine */}
      <div style={sc({ padding: "12px 8px", marginBottom: 14 })}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "rgba(255,255,255,0.55)", padding: "0 6px 8px", textTransform: "uppercase" }}>{t("player.today.week")}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {week.map((iso) => {
            const di = dayInfo(iso); const isToday = iso === today;
            const dot = di.state === "done" ? C.green : di.state === "partial" ? C.amb : null;
            return (
              <button key={iso} onClick={() => setDaySel(iso)} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "7px 2px", borderRadius: 12, cursor: "pointer", background: isToday ? `${accent}1f` : "transparent", border: `1.5px solid ${isToday ? accent : "transparent"}` }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{dstr(iso, { weekday: "short" }).slice(0, 3)}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: isToday ? "#fff" : "rgba(255,255,255,0.85)" }}>{new Date(iso + "T00:00:00").getDate()}</span>
                <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {di.state === "done" ? <Check size={13} color={C.green} /> : dot ? <span style={{ width: 6, height: 6, borderRadius: 4, background: dot }} /> : <span style={{ width: 6, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cartes d'action du jour */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ActionCard emoji="☀️" title={t("player.bilan.morning")} sub={t("player.today.morningSub")} state={day.matin ? "done" : "todo"} accent={accent} onClick={() => setSheet("morning")} t={t} />
        <ActionCard emoji="🌙" title={t("player.bilan.evening")} sub={t("player.today.eveningSub")} state={day.soir ? "done" : "todo"} accent={accent} onClick={() => setSheet("evening")} t={t} />
        {todaySessions.length > 0 ? (
          <ActionCard emoji="🏋️" title={t("player.today.session")} sub={t("player.today.sessionSub", { count: todaySessions.length })} state={info.sessDone === info.sessTotal ? "done" : "todo"} accent={accent} onClick={() => setSheet("session")} t={t} />
        ) : (
          <ActionCard emoji="🏋️" title={t("player.today.freeSession")} sub={t("player.today.freeSessionSub")} state={null} accent={accent} onClick={() => !preview && setBuilding(true)} t={t} />
        )}
        <span id="activite-jour" />
        <ActionCard emoji="⚡" title={t("player.today.activities")} sub={t("player.today.activitiesSub")} state={(day.matin?.activities?.length) ? "done" : "todo"} accent={accent} onClick={() => setSheet("activities")} t={t} />
        <ActionCard emoji="🔥" title={t("player.today.defis")} sub={t("player.today.defisSub")} badge={badges.defis} accent={accent} onClick={() => go?.("defis")} t={t} />
        <ActionCard emoji="📋" title={t("player.today.taches")} sub={t("player.today.tachesSub")} badge={badges.taches} accent={accent} onClick={() => go?.("taches")} t={t} />
      </div>
      <div style={{ height: 10 }} />

      {/* ── Feuilles (bottom-sheets) ── */}
      {sheet === "morning" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.bilan.morning")} t={t} /><div style={{ padding: "0 18px 22px" }}><MorningForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {sheet === "evening" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.bilan.evening")} t={t} /><div style={{ padding: "0 18px 22px" }}><EveningForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {sheet === "activities" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.today.activities")} t={t} /><div style={{ padding: "0 18px 22px" }}><ActivitiesForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {sheet === "session" && (
        <Overlay onClose={closeSheet} sheet z={320}>
          <SheetHead title={t("player.today.session")} t={t} />
          <div style={{ padding: "0 16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            {todaySessions.length === 0
              ? <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12.5, padding: 18 }}>{t("player.today.noSessionToday")}</div>
              : todaySessions.map((s) => <SessionPlayCard key={s.id} s={s} me={me} log={logs?.[s.id]?.[me.id]} sessions={sessions} logs={logs} accent={accent} onSaved={refresh} />)}
          </div>
        </Overlay>
      )}

      {/* ── Détail d'un jour ── */}
      {daySel && (
        <Overlay onClose={() => setDaySel(null)} sheet z={315}>
          <SheetHead title={dstr(daySel, { weekday: "long", day: "numeric", month: "long" })} t={t} />
          <DayDetail isToday={daySel === today} info={dayInfo(daySel)}
            onMorning={() => { setDaySel(null); setSheet("morning"); }}
            onEvening={() => { setDaySel(null); setSheet("evening"); }}
            onSession={() => { setDaySel(null); setSheet("session"); }}
            t={t} />
        </Overlay>
      )}

      {building && <FreeSessionBuilder me={me} onClose={() => setBuilding(false)} onCreated={refresh} />}
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

// Grande carte d'action cliquable (état à remplir / fait ✓, ou pastille de non-lu).
function ActionCard({ emoji, title, sub, state, accent, onClick, badge, t }) {
  const pill = state === "done"
    ? { txt: t("player.today.done"), bg: `${C.green}22`, bd: `${C.green}66`, col: C.green }
    : state === "todo"
      ? { txt: t("player.today.toFill"), bg: "rgba(255,255,255,0.06)", bd: C.border, col: "rgba(255,255,255,0.6)" }
      : null;
  return (
    <button onClick={onClick} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer", textAlign: "left", width: "100%" })}>
      <span style={{ fontSize: 26, width: 34, textAlign: "center", flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{sub}</div>
      </div>
      {typeof badge === "number" && badge > 0 && (
        <span style={{ background: accent, color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{badge}</span>
      )}
      {pill && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.col, flexShrink: 0 }}>{pill.txt}</span>}
      <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
    </button>
  );
}

// Détail d'un jour : aujourd'hui = actions ; passé = résumé lecture seule.
function DayDetail({ isToday, info, onMorning, onEvening, onSession, t }) {
  const line = (label, done, onClick) => (
    <button onClick={isToday ? onClick : undefined} disabled={!isToday} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, width: "100%", textAlign: "left", cursor: isToday ? "pointer" : "default" }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: done ? `${C.green}22` : "rgba(255,255,255,0.06)", border: `1px solid ${done ? C.green + "66" : C.border}`, color: done ? C.green : "rgba(255,255,255,0.6)" }}>
        {done ? t("player.bilan.blockDone") : t("player.today.toFill")}
      </span>
      {isToday && <ChevronRight size={15} color="rgba(255,255,255,0.35)" />}
    </button>
  );
  return (
    <div style={{ padding: "0 18px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
      {!isToday && <div style={{ fontSize: 11, color: C.amb, fontWeight: 700, marginBottom: 4 }}>{t("player.today.pastReadonly")}</div>}
      {line(t("player.bilan.morning"), info.hasM, onMorning)}
      {line(t("player.bilan.evening"), info.hasS, onEvening)}
      {info.sessTotal > 0
        ? line(t("player.today.sessionN", { done: info.sessDone, total: info.sessTotal }), info.sessDone === info.sessTotal, onSession)
        : <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", padding: "8px 4px" }}>{t("player.today.noSessionDay")}</div>}
    </div>
  );
}
