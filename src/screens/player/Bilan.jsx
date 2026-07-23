import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, sc, sessionCodeLabel } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { posDisplay } from "../../lib/positions.js";
import { wbToWellness, computeReadiness, statusOfLog, todayISO, isoDate, parseISO } from "../../lib/metrics.js";
import { WEEKLY_GOAL_DAYS } from "../../lib/badges.js";
import { Ring, Overlay, LineChart } from "../../lib/ui.jsx";
import { ChevronRight, Check } from "../../lib/icons.jsx";
import { useMyDay, usePlayerCheckins } from "../../data/checkins.js";
import { useProgramDocs, getProgramDoc } from "../../data/programDocs.js";
import { useTeamProgramAssignments } from "../../data/programAssignments.js";
import { isVisibleToPlayer, mergeTargets } from "../../lib/program/assign.js";
import { usePreview } from "../../lib/preview.js";
import MorningForm from "./bilan/MorningForm.jsx";
import EveningForm from "./bilan/EveningForm.jsx";
import ActivitiesForm from "./bilan/ActivitiesForm.jsx";
import SessionPlayCard from "./SessionPlayCard.jsx";
import FreeSessionBuilder from "./FreeSessionBuilder.jsx";
import ProgramView from "../shared/ProgramView.jsx";
import Defis from "./Defis.jsx";
import Taches from "./Taches.jsx";

/* Tableau de bord « Aujourd'hui » (joueur) — hub du jour : bandeau semaine
   (pastilles d'état par jour) + cartes d'action (bilans, séances/programmes
   assignés du jour, protocoles, activités, défis/tâches). Une carte par séance
   assignée aujourd'hui → lecteur set-par-set en feuille (validation = done + RPE
   + points, inchangé) ; les protocoles s'ouvrent en consultation. « Séance
   libre » en secondaire. Objectif hebdo = jours avec ≥ 1 séance validée / cible
   (WEEKLY_GOAL_DAYS) ; la pastille du bandeau suit la même définition. Tout se
   valide sur place, saisie du JOUR MÊME ; jours passés = lecture seule. Formules
   readiness/points INCHANGÉES (on réorganise l'accès, pas le calcul). */
export default function Bilan({ me, accent = C.green, teamId, players = [], sessions = [], logs = {}, bilans = {}, badges = {} }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const { day, refresh } = useMyDay(me.id);
  const [sheet, setSheet] = useState(null);   // morning | evening | activities | defis | taches
  const [openSession, setOpenSession] = useState(null); // session unique, ou "all" (toutes celles du jour)
  const [viewingProto, setViewingProto] = useState(null); // protocole ouvert en consultation
  const [daySel, setDaySel] = useState(null); // iso du jour ouvert en détail
  const [building, setBuilding] = useState(false);
  const [metric, setMetric] = useState(null); // readiness | wellness | charge (drill-down suivi)
  const { checkins } = usePlayerCheckins(me.id, 21);

  // Protocoles PUBLIÉS visibles par le joueur (même logique que l'onglet Protocoles).
  const { docs: protoDocs } = useProgramDocs(teamId);
  const { assignments: protoAsgs } = useTeamProgramAssignments(teamId);
  const protoCtx = { playerId: me.id, group: me.grp };
  const asgsForProto = (id) => protoAsgs.filter((a) => a.programId === id);
  const myProtocols = useMemo(
    () => protoDocs.filter((d) => d.status === "published" && isVisibleToPlayer(asgsForProto(d.id), protoCtx)),
    [protoDocs, protoAsgs, me.id, me.grp], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const today = todayISO();

  // Info d'un jour : séances assignées + statut, bilans matin/soir, complétude.
  // « Jour validé » (pastille verte + objectif hebdo) = au moins UNE séance
  // assignée ce jour-là passée en `done`. Les bilans seuls → état « partiel ».
  const dayInfo = useMemo(() => (iso) => {
    const daySessions = sessions.filter((s) => s.date === iso && (s.assignedIds || []).includes(me.id));
    const done = daySessions.filter((s) => statusOfLog(logs, s.id, me.id) === "done").length;
    const moments = new Set((bilans[me.id] || []).filter((b) => b.date === iso).map((b) => b.moment));
    const hasM = moments.has("matin"), hasS = moments.has("soir");
    const validated = done >= 1;
    const any = hasM || hasS || done > 0;
    return { daySessions, sessTotal: daySessions.length, sessDone: done, hasM, hasS, state: validated ? "done" : any ? "partial" : "none" };
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

  // Objectif de la semaine : nombre de JOURS avec ≥ 1 séance validée / cible (3).
  const goal = useMemo(() => {
    const done = week.filter((iso) => dayInfo(iso).sessDone >= 1).length;
    return { done, total: WEEKLY_GOAL_DAYS };
  }, [week, dayInfo]);

  // Séries pour le suivi rapide (sparklines) : readiness / bien-être / charge.
  const series = useMemo(() => {
    const matin = [...checkins].reverse().filter((c) => c.moment === "matin"); // ancien → récent
    const readinessS = matin.map((c) => computeReadiness(wbToWellness(c.wb, c.sleepH) || 0, me.risque, c.sleepH));
    const wellnessS = matin.map((c) => wbToWellness(c.wb, c.sleepH) || 0);
    const chargeS = (me._load?.hist || []).slice(-14).map((x) => Math.round(x.au || 0));
    return { readiness: readinessS, wellness: wellnessS, charge: chargeS };
  }, [checkins, me.risque, me._load]);

  // Checkins indexés par jour (pour enrichir le résumé d'un jour passé).
  const ckByDay = useMemo(() => {
    const m = {};
    for (const c of checkins) (m[c.date] ||= {})[c.moment] = c;
    return m;
  }, [checkins]);

  const metricDefs = {
    readiness: { label: t("player.bilan.readiness"), pts: series.readiness, color: readiness > 70 ? C.green : readiness > 50 ? C.amb : C.coral, value: readiness, max: 100 },
    wellness: { label: t("player.bilan.ringWellbeing"), pts: series.wellness, color: C.blue, value: me.wellness ?? (series.wellness.at(-1) || 0), max: 50 },
    charge: { label: t("player.bilan.ringCharge"), pts: series.charge, color: C.teal, value: series.charge.at(-1) ?? 0, max: null },
  };

  const todaySessions = info.daySessions;
  const onSaved = () => refresh();
  const closeSheet = () => setSheet(null);

  // Ouvre un protocole en consultation (doc complet + cibles individualisées).
  const openProto = async (row) => {
    try {
      const full = await getProgramDoc(row.id);
      const targets = mergeTargets(asgsForProto(row.id), protoCtx);
      setViewingProto({ id: full.id, title: full.title, doc: full.doc, targets });
    } catch (e) { console.error("[bilan protocols]", e.message); }
  };

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

      {/* Objectif de la semaine */}
      <div style={sc({ padding: 14, marginBottom: 14 })}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, flex: 1 }}>{t("player.today.goalTitle")}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{goal.done}<span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>/{goal.total}</span></span>
        </div>
        <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, goal.total ? (goal.done / goal.total) * 100 : 0)}%`, background: `linear-gradient(90deg, ${accent}, ${C.teal})`, borderRadius: 6, transition: "width .4s ease" }} />
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          {t("player.today.goalDays")}
        </div>
      </div>

      {/* Cartes d'action du jour */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ActionCard emoji="☀️" title={t("player.bilan.morning")} sub={t("player.today.morningSub")} state={day.matin ? "done" : "todo"} accent={accent} onClick={() => setSheet("morning")} t={t} />
        <ActionCard emoji="🌙" title={t("player.bilan.evening")} sub={t("player.today.eveningSub")} state={day.soir ? "done" : "todo"} accent={accent} onClick={() => setSheet("evening")} t={t} />

        {/* Cartes dynamiques : une par séance/programme assigné aujourd'hui */}
        {todaySessions.map((s) => {
          const st = statusOfLog(logs, s.id, me.id);
          const n = (s.exercises || []).length;
          return (
            <ActionCard key={s.id} emoji="🏋️"
              title={s.titre || t("player.today.session")}
              sub={`${sessionCodeLabel(t, s.code)} · ${t("player.today.exoCount", { count: n })}`}
              state={st === "done" ? "done" : "todo"}
              extra={st === "missed" ? t("player.today.stMissed") : st === "postponed" ? t("player.today.stPostponed") : null}
              accent={accent} onClick={() => setOpenSession(s)} t={t} />
          );
        })}

        {/* Protocoles assignés (consultation) */}
        {myProtocols.map((d) => (
          <ActionCard key={d.id} emoji="📄"
            title={d.title || t("nav.protocols")}
            sub={t("player.today.protocolSub")}
            state={null} accent={accent} onClick={() => openProto(d)} t={t} />
        ))}

        <span id="activite-jour" />
        {/* Séance libre — secondaire, pour les jours sans assignation */}
        <ActionCard emoji="➕" title={t("player.today.freeSession")} sub={t("player.today.freeSessionSecondary")} state={null} accent={accent} muted onClick={() => !preview && setBuilding(true)} t={t} />

        <ActionCard emoji="⚡" title={t("player.today.activities")} sub={t("player.today.activitiesSub")} state={(day.matin?.activities?.length) ? "done" : "todo"} accent={accent} onClick={() => setSheet("activities")} t={t} />
        <ActionCard emoji="🔥" title={t("player.today.defis")} sub={t("player.today.defisSub")} badge={badges.defis} accent={accent} onClick={() => setSheet("defis")} t={t} />
        <ActionCard emoji="📋" title={t("player.today.taches")} sub={t("player.today.tachesSub")} badge={badges.taches} accent={accent} onClick={() => setSheet("taches")} t={t} />
      </div>

      {/* Suivi rapide (sparklines) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{t("player.today.tracking")}</div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t("player.today.trackingHint")}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {["readiness", "wellness", "charge"].map((k) => {
          const m = metricDefs[k]; const enough = m.pts.length >= 2;
          return (
            <button key={k} onClick={() => enough && setMetric(k)} style={sc({ padding: 12, textAlign: "left", cursor: enough ? "pointer" : "default" })}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: m.color, margin: "2px 0 4px" }}>{Math.round(m.value)}{m.max === 50 ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>/50</span> : null}</div>
              <div style={{ height: 30 }}>
                {enough ? <LineChart pts={m.pts.slice(-14)} color={m.color} height={30} /> : <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{t("player.today.notEnough")}</div>}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ height: 10 }} />

      {/* ── Feuilles (bottom-sheets) ── */}
      {sheet === "morning" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.bilan.morning")} t={t} /><div style={{ padding: "0 18px 22px" }}><MorningForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {sheet === "evening" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.bilan.evening")} t={t} /><div style={{ padding: "0 18px 22px" }}><EveningForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {sheet === "activities" && <Overlay onClose={closeSheet} sheet z={320}><SheetHead title={t("player.today.activities")} t={t} /><div style={{ padding: "0 18px 22px" }}><ActivitiesForm me={me} accent={accent} day={day} preview={preview} onSaved={onSaved} /></div></Overlay>}
      {openSession && (() => {
        const list = openSession === "all" ? todaySessions : [openSession];
        return (
          <Overlay onClose={() => setOpenSession(null)} sheet z={320}>
            <SheetHead title={list.length === 1 ? (list[0]?.titre || t("player.today.session")) : t("player.today.session")} t={t} />
            <div style={{ padding: "0 16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
              {list.length === 0
                ? <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12.5, padding: 18 }}>{t("player.today.noSessionToday")}</div>
                : list.map((s) => <SessionPlayCard key={s.id} s={s} me={me} log={logs?.[s.id]?.[me.id]} sessions={sessions} logs={logs} accent={accent} onSaved={refresh} />)}
            </div>
          </Overlay>
        );
      })()}

      {viewingProto && (
        <ProgramView id={viewingProto.id} doc={viewingProto.doc} title={viewingProto.title} targets={viewingProto.targets} onClose={() => setViewingProto(null)} />
      )}

      {sheet === "defis" && <Overlay onClose={closeSheet} sheet z={320}><div style={{ padding: "0 18px 24px" }}><Defis me={me} players={players} accent={accent} /></div></Overlay>}
      {sheet === "taches" && <Overlay onClose={closeSheet} sheet z={320}><div style={{ padding: "0 18px 24px" }}><Taches me={me} players={players} accent={accent} /></div></Overlay>}

      {/* ── Détail d'un jour ── */}
      {daySel && (
        <Overlay onClose={() => setDaySel(null)} sheet z={315}>
          <SheetHead title={dstr(daySel, { weekday: "long", day: "numeric", month: "long" })} t={t} />
          <DayDetail isToday={daySel === today} info={dayInfo(daySel)} ck={ckByDay[daySel]} me={me}
            onMorning={() => { setDaySel(null); setSheet("morning"); }}
            onEvening={() => { setDaySel(null); setSheet("evening"); }}
            onSession={() => { setDaySel(null); setOpenSession("all"); }}
            t={t} />
        </Overlay>
      )}

      {/* ── Détail d'un indicateur (suivi) ── */}
      {metric && metricDefs[metric] && (
        <Overlay onClose={() => setMetric(null)} sheet z={315}>
          <SheetHead title={metricDefs[metric].label} t={t} />
          <div style={{ padding: "0 18px 24px" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: metricDefs[metric].color, marginBottom: 10 }}>
              {Math.round(metricDefs[metric].value)}{metricDefs[metric].max ? <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>/{metricDefs[metric].max}</span> : null}
            </div>
            <div style={sc({ padding: 12 })}>
              <LineChart pts={metricDefs[metric].pts} color={metricDefs[metric].color} height={160} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 10, textAlign: "center" }}>{t("player.today.trackingRange", { count: metricDefs[metric].pts.length })}</div>
          </div>
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
// `extra` = petit libellé secondaire (ex. « manqué »/« reporté ») ; `muted` =
// carte secondaire (séance libre) légèrement estompée.
function ActionCard({ emoji, title, sub, state, accent, onClick, badge, extra, muted, t }) {
  const pill = state === "done"
    ? { txt: t("player.today.done"), bg: `${C.green}22`, bd: `${C.green}66`, col: C.green }
    : state === "todo"
      ? { txt: t("player.today.toFill"), bg: "rgba(255,255,255,0.06)", bd: C.border, col: "rgba(255,255,255,0.6)" }
      : null;
  return (
    <button onClick={onClick} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer", textAlign: "left", width: "100%", opacity: muted ? 0.82 : 1, background: muted ? "rgba(255,255,255,0.02)" : undefined, transition: "transform .12s ease, border-color .12s ease" })}
      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.985)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
      <span style={{ fontSize: 26, width: 34, textAlign: "center", flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{sub}</div>
      </div>
      {extra && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: `${C.coral}18`, border: `1px solid ${C.coral}55`, color: C.coral, flexShrink: 0 }}>{extra}</span>}
      {typeof badge === "number" && badge > 0 && (
        <span style={{ background: accent, color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{badge}</span>
      )}
      {pill && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.col, flexShrink: 0 }}>{pill.txt}</span>}
      <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
    </button>
  );
}

// Détail d'un jour : aujourd'hui = actions cliquables ; passé = résumé enrichi (lecture seule).
function DayDetail({ isToday, info, ck, me, onMorning, onEvening, onSession, t }) {
  const line = (label, done, onClick) => (
    <button onClick={isToday ? onClick : undefined} disabled={!isToday} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, width: "100%", textAlign: "left", cursor: isToday ? "pointer" : "default", transition: "background .15s ease" }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: done ? `${C.green}22` : "rgba(255,255,255,0.06)", border: `1px solid ${done ? C.green + "66" : C.border}`, color: done ? C.green : "rgba(255,255,255,0.6)" }}>
        {done ? t("player.bilan.blockDone") : t("player.today.toFill")}
      </span>
      {isToday && <ChevronRight size={15} color="rgba(255,255,255,0.35)" />}
    </button>
  );

  if (isToday) {
    return (
      <div style={{ padding: "0 18px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
        {line(t("player.bilan.morning"), info.hasM, onMorning)}
        {line(t("player.bilan.evening"), info.hasS, onEvening)}
        {info.sessTotal > 0
          ? line(t("player.today.sessionN", { done: info.sessDone, total: info.sessTotal }), info.sessDone === info.sessTotal, onSession)
          : <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", padding: "8px 4px" }}>{t("player.today.noSessionDay")}</div>}
      </div>
    );
  }

  // Jour passé : résumé enrichi en lecture seule (données réelles du bilan matin).
  const mc = ck?.matin;
  const readiness = mc ? computeReadiness(wbToWellness(mc.wb, mc.sleepH) || 0, me.risque, mc.sleepH) : null;
  const wellness = mc ? (wbToWellness(mc.wb, mc.sleepH) || 0) : null;
  const stat = (label, value, sub, color) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "10px 6px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: color || "#fff", margin: "2px 0" }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ padding: "0 18px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: C.amb, fontWeight: 700 }}>{t("player.today.pastReadonly")}</div>
      {mc ? (
        <div style={{ display: "flex", gap: 8 }}>
          {stat(t("player.bilan.readiness"), Math.round(readiness), null, readiness > 70 ? C.green : readiness > 50 ? C.amb : C.coral)}
          {stat(t("player.bilan.ringWellbeing"), `${Math.round(wellness)}`, "/ 50", C.blue)}
          {stat(t("player.today.sleep"), mc.sleepH != null ? `${mc.sleepH}h` : "—", null, C.teal)}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", padding: "6px 4px" }}>{t("player.today.noMorning")}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SummaryRow label={t("player.bilan.evening")} done={info.hasS} t={t} />
        {info.sessTotal > 0
          ? <SummaryRow label={t("player.today.sessionN", { done: info.sessDone, total: info.sessTotal })} done={info.sessDone === info.sessTotal} t={t} />
          : <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", padding: "4px 4px" }}>{t("player.today.noSessionDay")}</div>}
      </div>
    </div>
  );
}

// Ligne de résumé lecture seule (jour passé) : libellé + pastille fait/absent.
function SummaryRow({ label, done, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: done ? `${C.green}22` : "rgba(255,255,255,0.06)", border: `1px solid ${done ? C.green + "66" : C.border}`, color: done ? C.green : "rgba(255,255,255,0.55)" }}>
        {done ? t("player.bilan.blockDone") : t("player.today.absent")}
      </span>
    </div>
  );
}
