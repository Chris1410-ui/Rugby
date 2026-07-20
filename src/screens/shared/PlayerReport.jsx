import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { acwrZ, computePoints, statusOfLog, fmtShort, ACTIVITIES, EVENING_MARKERS } from "../../lib/metrics.js";
import { Ring, Section, KPI, Tag, CloseX, useModalClose } from "../../lib/ui.jsx";
import { MessageSquare, Shield } from "../../lib/icons.jsx";
import { usePlayerCheckins, bilanEventsOf } from "../../data/checkins.js";
import { useReadOnly } from "../../lib/readonly.js";
import { useTestCampaigns } from "../../data/tests.js";
import { useTeamTaskPoints } from "../../data/tasks.js";
import { useTeamChallengePoints } from "../../data/challenges.js";
import { challengeBadges } from "../../lib/challenges.js";
import { useTeamReactivity } from "../../data/notifications.js";
import { markKine, markTreated } from "../../data/alerts.js";
import { top14Player, datedResultsFor, withCurrentBodyweight } from "../../lib/top14.js";
import { prescribedVsRealized } from "../../lib/hevy.js";
import Conversation from "./Conversation.jsx";
import TestsEvolution from "./TestsEvolution.jsx";
import Top14Panel from "./Top14Panel.jsx";

const accent = C.coral;

// Marqueurs bien-être (ordre = écran joueur) + sens d'amélioration.
// Libellé résolu via t("shared.report.wb.<k>") au rendu.
const WB = [
  { k: "sleep", better: "up" },
  { k: "energy", better: "up" },
  { k: "mood", better: "up" },
  { k: "fatigue", better: "down" },
  { k: "soreness", better: "down" },
  { k: "stress", better: "down" },
];
const actLabel = Object.fromEntries(ACTIVITIES.map((a) => [a.key, `${a.emoji} ${a.label}`]));

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("fr-BE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
};

/* Récap complet d'un joueur (vue préparateur) — AFFICHAGE SEUL : lit l'effectif
   enrichi (enrichPlayers) + les logs + les bilans, sans aucun recalcul. Ouvert
   depuis une alerte (avec `reason`) ou l'effectif. */
export default function PlayerReport({ player, sessions, logs, activities = [], reason, onClose, onEditFiche }) {
  const { t } = useTranslation();
  const [thread, setThread] = useState(false);
  const [aNote, setANote] = useState("");
  const [openSess, setOpenSess] = useState(null); // séance dépliée (détail prescrit vs réalisé)
  useModalClose(onClose);
  const readOnly = useReadOnly();
  const canAct = !readOnly && !!reason?.key; // ouvert depuis une alerte → actions kiné/traiter (jamais en lecture seule)
  const { checkins } = usePlayerCheckins(player.id);
  const matinList = checkins.filter((c) => c.moment !== "soir");
  const soirList = checkins.filter((c) => c.moment === "soir");
  const cur = matinList[0] || null;      // dernier bilan MATIN
  const prev = matinList[1] || null;     // matin précédent (évolution)
  const curSoir = soirList[0] || null;   // dernier bilan SOIR

  const { campaigns, results } = useTestCampaigns(player.team);
  const t14 = top14Player(player.pos, withCurrentBodyweight(player, datedResultsFor(campaigns, results, player.id)));
  const taskPts = useTeamTaskPoints(player.team);
  const taskEvents = (taskPts[player.id] || []).map((t) => ({ label: t.titre, date: t.date }));
  const reactEvents = useTeamReactivity(player.team)[player.id] || [];
  const bilanEvents = bilanEventsOf(checkins.map((c) => ({ date: c.date, moment: c.moment })));
  const chalPts = useTeamChallengePoints(player.team)[player.id] || [];
  const challengeEvents = chalPts.map((c) => ({ label: c.titre, points: c.points, date: c.date }));
  const pts = computePoints(player, sessions, logs, activities, t14.events, taskEvents, reactEvents, bilanEvents, challengeEvents);
  const zone = acwrZ(player.acwr);

  // Dernières séances assignées (récentes d'abord) + statut + RPE.
  const mine = sessions
    .filter((s) => s.assignedIds?.includes(player.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((s) => ({ s, st: statusOfLog(logs, s.id, player.id), rpe: logs?.[s.id]?.[player.id]?.rpe }));

  const stCfg = { done: { c: C.green, l: t("shared.report.stDone") }, missed: { c: C.coral, l: t("shared.report.stMissed") }, postponed: { c: C.gray, l: t("shared.report.stPostponed") }, pending: { c: C.amb, l: t("shared.report.stPending") } };

  return (
    <>
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 340, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: C.navy, borderRadius: 18, padding: 18, maxHeight: "92vh", overflowY: "auto" }}>
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, position: "sticky", top: 0, zIndex: 5, background: C.navy, paddingBottom: 8 }}>
          <Ring val={player.readiness} max={100} color={player.readiness > 70 ? C.green : player.readiness > 50 ? C.amb : C.coral} label={t("shared.report.ready")} size={58} sw={5} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>{displayName(player)}{player.isDemo && <span style={{ fontSize: 8.5, fontWeight: 800, color: C.viol, background: `${C.viol}22`, border: `1px solid ${C.viol}55`, borderRadius: 5, padding: "1px 5px" }}>{t("shared.report.demoBadge")}</span>}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>#{player.num ?? "—"} · {player.pos} · {grpLabel(player.grp)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontStyle: "italic", color: pts.div.c }}>{pts.pts}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{pts.div.e} {pts.div.l}</div>
          </div>
          <CloseX onClose={onClose} />
        </div>

        {/* Raison de l'alerte (si ouvert depuis une alerte) */}
        {reason && (
          <div style={sc({ marginBottom: 12, borderLeft: `4px solid ${reason.color || C.coral}`, background: `${reason.color || C.coral}1a` })}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: reason.color || C.coral, marginBottom: 3 }}>{t("shared.report.alert", { cat: reason.cat })}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{reason.icon} {reason.txt}</div>
          </div>
        )}

        {/* Bilan du MATIN détaillé */}
        <Section title={t("shared.report.morningTitle")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{cur ? fmtDateTime(cur.createdAt) : t("shared.report.notFilled")}</span>}>
          {!cur ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t("shared.report.morningEmpty")}</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                {WB.map((m) => {
                  const v = cur.wb?.[m.k];
                  const pv = prev?.wb?.[m.k];
                  const d = v != null && pv != null ? v - pv : null;
                  const improved = d == null || d === 0 ? null : (m.better === "up" ? d > 0 : d < 0);
                  const dc = improved == null ? "rgba(255,255,255,0.4)" : improved ? C.green : C.coral;
                  return (
                    <div key={m.k} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{t("shared.report.wb." + m.k)}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontSize: 17, fontWeight: 800 }}>{v ?? "—"}</span><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>/10</span>
                        {d != null && d !== 0 && <span style={{ fontSize: 10, fontWeight: 800, color: dc }}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <Tag c={C.viol}>💤 {cur.sleepH ?? "—"} h</Tag>
                <Tag c={C.teal}>💧 {cur.hydra ?? "—"} L</Tag>
                {cur.fc != null && <Tag c={C.coral}>{t("shared.report.tagFc", { v: cur.fc })}</Tag>}
                {cur.hrv != null && <Tag c={C.green}>{t("shared.report.tagHrv", { v: cur.hrv })}</Tag>}
                {cur.poids != null && <Tag c={C.blue}>{t("shared.report.tagKg", { v: cur.poids })}</Tag>}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{t("shared.report.activityDeclared")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(cur.activities || []).length === 0
                  ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t("shared.report.none")}</span>
                  : cur.activities.map((a) => <Tag key={a} c={C.green}>{actLabel[a] || a}</Tag>)}
              </div>
            </>
          )}
        </Section>

        {/* Bilan du SOIR détaillé (6 marqueurs + ressenti match + remarques) */}
        <Section title={t("shared.report.eveningTitle")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{curSoir ? fmtDateTime(curSoir.createdAt) : t("shared.report.notFilled")}</span>}>
          {!curSoir ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t("shared.report.eveningEmpty")}</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                {EVENING_MARKERS.map((m) => (
                  <div key={m.k} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{m.l}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>{curSoir.wb?.[m.k] ?? "—"}</span><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>/10</span>
                    </div>
                  </div>
                ))}
              </div>
              {curSoir.wb?.ressentiMatch && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>{t("shared.report.matchFeeling")}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{curSoir.wb.ressentiMatch}</div>
                </div>
              )}
              {curSoir.wb?.remarques && (
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>{t("shared.report.remarks")}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{curSoir.wb.remarques}</div>
                </div>
              )}
            </>
          )}
        </Section>

        {/* Badges défis */}
        {chalPts.length > 0 && (
          <Section title={t("shared.report.chalSection", { count: chalPts.length })}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {challengeBadges(chalPts.length).map((b) => (
                <span key={b.n} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(108,92,224,0.25)", border: `1px solid ${C.viol}66`, borderRadius: 6, padding: "3px 9px" }}>{b.emoji} {b.label}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{t("shared.report.chalPts", { pts: chalPts.reduce((a, c) => a + (c.points || 0), 0) })}</div>
          </Section>
        )}

        {/* Charge */}
        <Section title={t("shared.report.loadTitle")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <KPI label={t("shared.report.kpiAcwr")} value={player.acwr?.toFixed?.(2) ?? player.acwr} color={zone.c} sub={zone.l} />
            <KPI label={t("shared.report.kpiLoad7d")} value={player.charge7j} sub={t("shared.report.subUa")} color={C.coral} />
            <KPI label={t("shared.report.kpiMonotony")} value={player.monotonie} color={player.monotonie > 2 ? C.amb : C.green} />
            <KPI label={t("shared.report.kpiStrain")} value={player.strain} color={C.viol} />
            <KPI label={t("shared.report.kpiRisk")} value={player.risque} sub="/100" color={player.risque >= 60 ? C.coral : player.risque >= 40 ? C.amb : C.green} />
            <KPI label={t("shared.report.kpiWellness")} value={`${player.wellness}/50`} color={C.blue} />
          </div>
        </Section>

        {/* Compliance / dernières séances */}
        <Section title={t("shared.report.lastSessions")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{t("shared.report.sessionsSummary", { done: pts.doneCount, missed: pts.missedCount })}</span>}>
          {mine.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t("shared.report.noSessions")}</div>
          ) : mine.map(({ s, st, rpe }) => {
            const cfg = stCfg[st] || stCfg.pending;
            const pe = logs?.[s.id]?.[player.id]?.perExercise || {};
            const hasDetail = st === "done" && (s.exercises || []).length > 0;
            const open = openSess === s.id;
            return (
              <div key={s.id} style={{ borderBottom: `1px solid ${C.border2}` }}>
                <div onClick={() => hasDetail && setOpenSess(open ? null : s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", cursor: hasDetail ? "pointer" : "default" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, width: 54 }}>{fmtShort(s.date)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.code} · {s.titre}</span>
                  {hasDetail && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{open ? "▲" : t("shared.report.detailToggle")}</span>}
                  {rpe != null && st === "done" && <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>{t("shared.report.tagRpe", { v: rpe })}</span>}
                  <Tag c={cfg.c}>{cfg.l}</Tag>
                </div>
                {open && (
                  <div style={{ padding: "4px 0 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {s.exercises.map((e) => {
                      const cmp = prescribedVsRealized(e, pe[e.id]);
                      const note = (pe[e.id]?.note || "").trim();
                      return (
                        <div key={e.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{e.name}</div>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10.5 }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>{t("shared.report.prescribed")}<b style={{ color: "rgba(255,255,255,0.85)" }}>{e.sets}×{e.reps}{e.charge ? ` @ ${e.charge}` : ""}</b></span>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>{t("shared.report.realized")}<b style={{ color: cmp.diff ? C.amb : C.green }}>{cmp.hasRealized ? `${cmp.doneSets} ${t("shared.report.seriesShort")}${cmp.realTop > 0 ? t("shared.report.kgSuffix", { v: cmp.realTop }) : ""}` : "—"}</b></span>
                          </div>
                          {cmp.diff && (
                            <div style={{ fontSize: 10, color: C.amb, marginTop: 3, fontWeight: 700 }}>
                              ≠ {[cmp.setsDiff ? t("shared.report.setsDiff", { done: cmp.doneSets, presc: cmp.prescSets }) : null, cmp.chargeDiff ? t("shared.report.chargeDiff", { real: cmp.realTop, presc: cmp.prescCharge }) : null].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          {note && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 4, fontStyle: "italic", display: "flex", gap: 5 }}>
                              <span aria-hidden>💬</span><span>{note}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {logs?.[s.id]?.[player.id]?.feedback && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", padding: "2px 2px", display: "flex", gap: 5 }}>
                        <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{t("shared.report.sessionComment")}</span><span style={{ fontStyle: "italic" }}>{logs[s.id][player.id].feedback}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Section>

        {/* Tests (évolution par campagne, lecture seule) */}
        <TestsEvolution player={player} canEdit={false} />

        {/* Comparaison Top 14 du poste */}
        <Top14Panel t14={t14} />

        {/* Points */}
        <Section title={t("shared.report.pointsTitle")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{pts.streak >= 3 ? t("shared.report.streakLabel", { n: pts.streak }) : ""}</span>}>
          {pts.badges.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {pts.badges.map((b) => <Tag key={b.l} c={C.amb}>{b.e} {b.l}</Tag>)}
            </div>
          )}
          {pts.ev.slice(0, 6).map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{e.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{fmtShort(e.date)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: e.v >= 0 ? C.green : C.coral }}>{e.v >= 0 ? "+" : ""}{e.v}</span>
              </span>
            </div>
          ))}
        </Section>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {!readOnly && <button onClick={() => setThread(true)} style={{ flex: 1, background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><MessageSquare size={15} /> {t("shared.report.sendMessage")}</button>}
            {onEditFiche && (
              <button onClick={() => { onEditFiche(); onClose(); }} style={{ flex: readOnly ? 1 : "0 0 auto", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Shield size={15} /> {t("shared.report.ficheBtn")}{readOnly ? t("shared.report.consultationSuffix") : ""}</button>
            )}
          </div>
          {canAct && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => markKine(player.team, reason).then(() => setANote(t("shared.report.kineSent"))).catch((e) => setANote(t("shared.report.actionFail", { err: e.message || "" })))} style={{ flex: 1, background: `${C.teal}1a`, border: `1px solid ${C.teal}66`, borderRadius: 10, padding: 11, color: C.teal, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("shared.report.sendKine")}</button>
              <button onClick={() => markTreated(player.team, reason).then(() => onClose()).catch((e) => setANote(t("shared.report.actionFail", { err: e.message || "" })))} style={{ flex: 1, background: C.green, border: "none", borderRadius: 10, padding: 11, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("shared.report.treat")}</button>
            </div>
          )}
          {aNote && <div style={{ fontSize: 11, color: aNote.includes("✓") ? C.green : C.coral, textAlign: "center" }}>{aNote}</div>}
        </div>
      </div>
    </div>
    {thread && (
      <div style={{ position: "fixed", inset: 0, zIndex: 350 }}>
        <Conversation playerId={player.id} title={displayName(player)} who="staff" accent={accent} onClose={() => setThread(false)} />
      </div>
    )}
    </>
  );
}
