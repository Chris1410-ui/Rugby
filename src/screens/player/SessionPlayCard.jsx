import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { fmtShort } from "../../lib/metrics.js";
import { Dot, Tag, NatureTag, RestTimer, LineChart, CloseX, useModalClose } from "../../lib/ui.jsx";
import { CheckCircle, Trophy, TrendingUp, Video, ExternalLink, FileText, BookOpen, Users, Clock, Pencil } from "../../lib/icons.jsx";
import { youtubeEmbed, safeVideoUrl } from "../../lib/youtube.js";
import {
  e1RM, SET_TYPES, nextSetType,
  lastExercisePerf, exerciseRecords, exerciseHistory, prescribedVsRealized,
} from "../../lib/hevy.js";
import { getProgramDoc } from "../../data/programDocs.js";
import { add1RM } from "../../data/player1rm.js";
import { useExercisePerf } from "../../data/exercisePerf.js";
import { resolveSetPlan } from "../../lib/oneRM.js";
import { exerciseInputModel, inputModelUsesLoad } from "../../lib/sessionType.js";
import { computeTargetPace, paceSecPerKmFromDistanceTime, speedKmhFromDistanceTime, formatPace, formatSpeed } from "../../lib/pace.js";
import { TEST_METRICS } from "../../data/tests.js";
import { useSessionLogging } from "./useSessionLogging.js";

// Libellé + unité d'un test de la batterie (pour les blocs cardio_test).
const testMeta = (key) => TEST_METRICS.find((m) => m.key === key) || null;
import ProgramView from "../shared/ProgramView.jsx";
import ExerciseInfoModal from "../shared/ExerciseInfoModal.jsx";

const playInp = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" };
const durBtn = { flexShrink: 0, width: 38, height: 38, borderRadius: 9, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" };

/* Logging set-par-set façon Hevy — porté du prototype (persistance Supabase). */
export default function SessionPlayCard({ s, me, log, sessions, logs, accent, onSaved, onDelete, onNavigate }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [graphEx, setGraphEx] = useState(null);
  const [proto, setProto] = useState(null);        // protocole source ouvert en lecture
  const [protoBusy, setProtoBusy] = useState(false);
  const [infoEx, setInfoEx] = useState(null);      // fiche exercice (nom) ouverte
  const [set1rm, setSet1rm] = useState(null);      // { label } : saisie rapide 1RM manquant

  // État + règles de saisie EXTRAITS dans un hook partagé avec la vue plein écran
  // (SessionLive) → comportement identique (1RM/reps, isolation (exo, série),
  // souveraineté). `active: open` pilote le chrono quand la carte est dépliée.
  const L = useSessionLogging({ s, me, log, sessions, logs, onSaved, active: open });
  const {
    preview, past, effNature, exos,
    ex, rpe, fb, dur, plannedDur, st,
    rest, setRest, justPR, busy,
    startedAt, elapsed,
    pctLoad, exOneRM, applyOneRM,
    setSet, addSet, delSet, setExNote, setMono, toggleSet,
    setRpe, setFb, setDur, setDirty,
    doneSets, totSets, valider,
  } = L;

  // Ouvre le PROTOCOLE source complet (consignes, sécurité, progression) en lecture.
  const openProtocol = async () => {
    if (!s.programDocId || protoBusy) return;
    setProtoBusy(true);
    try { const full = await getProgramDoc(s.programDocId); setProto({ id: full.id, title: full.title, doc: full.doc }); }
    catch (e) { console.error("[protocol read]", e.message); }
    setProtoBusy(false);
  };

  // Validation depuis la CARTE : ferme la carte + coupe le repos sur succès
  // (la carte gère son propre pliage ; le hook ne connaît pas `open`).
  const submit = async (status) => {
    const ok = await valider(status);
    if (ok) { setOpen(false); setRest(null); }
  };

  // Séance-test : les résultats sont saisis par le staff → carte informative,
  // pas de logging set-par-set côté joueur.
  if (s.code === "TEST") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: 14, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>🧪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{fmtShort(s.date)} · {s.titre}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("player.session.testHint")}</div>
        </div>
        <Tag c={C.blue}>{t("player.session.testTag")}</Tag>
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${st === "done" ? C.green : st === "missed" ? C.coral : st === "postponed" ? C.gray : accent}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <Dot s={st} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>{fmtShort(s.date)}</span>
            <Tag c={CODES[s.code] || accent} title={sessionCodeLabel(t, s.code)}>{s.code}</Tag>
            <NatureTag nature={s.nature} code={s.code} />
            {s.origin === "libre" && <Tag c={C.viol}>{t("player.session.freeTag")}</Tag>}
            <span style={{ fontSize: 12, fontWeight: 600 }}>{s.titre}</span>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("player.session.exercisesSeries", { ex: exos.length, sets: totSets })}</div>
        </div>
        {st === "done" && rpe && <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{t("player.session.rpeShort")} {rpe}</span>}
        {st === "pending" && past && <Tag c={C.amb}>{t("player.session.toValidate")}</Tag>}
        {st === "pending" && !past && <Tag c={accent}>{t("player.session.upcoming")}</Tag>}
        {st === "postponed" && <Tag c={C.gray}>{t("player.session.postponed")}</Tag>}
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {justPR && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${C.amb}22`, border: `1px solid ${C.amb}66`, borderRadius: 9, padding: "8px 12px", marginBottom: 10 }}>
              <Trophy size={15} color={C.amb} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.amb }}>{t("player.session.record", { ex: justPR.ex, w: justPR.w, orm: justPR.orm })}</span>
            </div>
          )}
          {rest && <RestTimer key={rest.k} seconds={rest.sec} accent={accent} onDone={() => setRest(null)} />}

          {s.programDocId && (
            <button onClick={openProtocol} disabled={protoBusy} style={{ width: "100%", marginBottom: 10, background: `${C.viol}18`, border: `1px solid ${C.viol}55`, borderRadius: 9, padding: "9px 12px", color: C.viol, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <FileText size={14} /> {protoBusy ? t("player.session.protocolLoading") : t("player.session.viewProtocol")}{s.sourceWeek ? ` · ${t("player.session.weekN", { n: s.sourceWeek })}` : ""}
            </button>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1 }}>{t("player.session.setsHeader")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: doneSets === totSets && totSets ? C.green : "rgba(255,255,255,0.5)" }}>{doneSets}/{totSets}</span>
          </div>

          {exos.map((e) => {
            const k = exerciseInputModel(e, effNature);
            // Blocs cardio structurés : rendus dédiés (jamais de kg ; distance/temps/allure).
            if (k === "cardio_continuous") return <CardioContinuous key={e.id} e={e} st={ex[e.id]} onField={(p) => setMono(e.id, p)} onNote={(v) => setExNote(e.id, v)} masKmh={me.mas} t={t} accent={accent} />;
            if (k === "cardio_interval") return <CardioInterval key={e.id} e={e} st={ex[e.id]} onRep={(i, p) => setSet(e.id, i, p)} onNote={(v) => setExNote(e.id, v)} masKmh={me.mas} t={t} accent={accent} />;
            if (k === "cardio_circuit") return <CardioCircuit key={e.id} e={e} st={ex[e.id]} onField={(p) => setMono(e.id, p)} onNote={(v) => setExNote(e.id, v)} t={t} accent={accent} />;
            if (k === "cardio_test") return <CardioTest key={e.id} e={e} st={ex[e.id]} onField={(p) => setMono(e.id, p)} onNote={(v) => setExNote(e.id, v)} onNavigate={onNavigate} t={t} accent={accent} />;
            // Efforts « plats » dérivés de la nature de la séance (pas de kg / %1RM).
            if (k === "conditioning") return <EffortConditioning key={e.id} e={e} st={ex[e.id]} onField={(p) => setMono(e.id, p)} onNote={(v) => setExNote(e.id, v)} masKmh={me.mas} t={t} accent={accent} />;
            if (k === "vitesse") return <EffortSpeed key={e.id} e={e} st={ex[e.id]} onField={(p) => setMono(e.id, p)} onNote={(v) => setExNote(e.id, v)} t={t} accent={accent} />;
            if (k === "mobility") return <EffortMobility key={e.id} e={e} st={ex[e.id]} onField={(p) => setMono(e.id, p)} onNote={(v) => setExNote(e.id, v)} t={t} accent={accent} />;
            const prev = lastExercisePerf(logs, sessions, me.id, e.name, s.date);
            const rec = exerciseRecords(logs, sessions, me.id, e.name, s.date);
            const cmp = prescribedVsRealized(e, { sets: ex[e.id].sets }); // prescrit vs réalisé (live)
            const pl = pctLoad(e); // charge calculée depuis le 1RM si exprimé en %
            // Séries détaillées : consigne + charge résolue (1RM) par série (arrondi 2,5).
            const plan = Array.isArray(e.setPlan) && e.setPlan.length ? resolveSetPlan(e.setPlan, exOneRM(e)) : null;
            const isSkillEx = !inputModelUsesLoad(k); // pas de kg : reps ou tenue (skill)
            const ecart = cmp.diff
              ? [cmp.setsDiff ? t("player.session.setsDiff", { done: cmp.doneSets, presc: cmp.prescSets }) : null,
                 cmp.chargeDiff ? t("player.session.chargeDiff", { real: cmp.realTop, presc: cmp.prescCharge }) : null]
                .filter(Boolean).join(" · ")
              : "";
            return (
              <div key={e.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setInfoEx(e.name)} title={t("player.session.exInfo")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex" }}>
                      <BookOpen size={13} />
                    </button>
                    <button onClick={() => setGraphEx(e.name)} title={t("player.session.progressTitle")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}>
                      <TrendingUp size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", marginBottom: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{t("player.session.prescribed")} {plan ? (e.presc || t("player.session.detailedSeries", { n: plan.length })) : (e.presc || `${e.sets}×${e.reps ?? (e.holdSec ? `${e.holdSec}s` : "")}${e.charge ? ` @ ${e.charge}` : ""}`)}{e.tempo ? ` · ${t("player.session.tempo")} ${e.tempo}` : ""}{e.rest ? ` · ${t("player.session.restPresc", { n: e.rest })}` : ""}</span>
                  <span>{t("player.session.prev")} {prev ? prev.sets.map((x) => `${x.w || "–"}×${x.reps || "–"}`).join("  ") : "—"}</span>
                  {rec.top > 0 && <span style={{ color: C.amb }}>{t("player.session.recBadge", { top: rec.top, orm: rec.oneRM })}</span>}
                </div>
                {e.note && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 6, fontStyle: "italic" }}>💬 {e.note}</div>}
                {pl && (
                  pl.oneRM != null ? (
                    // 1RM connu → ligne d'info COMPACTE et discrète, cliquable pour corriger sur place.
                    <button onClick={() => !preview && setSet1rm({ e })} disabled={preview} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6, background: "none", border: "none", padding: 0, cursor: preview ? "default" : "pointer", textAlign: "left", fontSize: 10.5 }}>
                      <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{t("player.session.rmRef", { movement: pl.label, kg: pl.oneRM })}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: pl.kind === "estime" ? C.amb : C.green }}>({t(pl.kind === "estime" ? "oneRM.estimated" : "oneRM.tested")})</span>
                      <span style={{ color: C.viol, fontWeight: 800 }}>· {t("player.session.rmLoad", { pct: pl.pct, kg: pl.kg })}</span>
                      {!preview && <Pencil size={11} color="rgba(255,255,255,0.4)" />}
                    </button>
                  ) : (
                    // 1RM manquant → badge orange, saisie EN PLACE (sans quitter la séance).
                    <button onClick={() => !preview && setSet1rm({ e })} style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, color: C.amb, background: `${C.amb}18`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>@{pl.pct}% · {t("player.session.setYour1RM", { movement: pl.label })}</button>
                  )
                )}
                {ecart && (
                  <div style={{ fontSize: 10, color: C.amb, marginBottom: 6, display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                    <span>{t("player.session.gap")}</span><span style={{ fontWeight: 600 }}>{ecart}</span>
                  </div>
                )}
                <ExerciseVideo url={e.video} accent={accent} />
                {ex[e.id].sets.map((x, i) => {
                  const stype = SET_TYPES[x.type] || SET_TYPES.normal;
                  const ph = prev?.sets?.[i];
                  const ps = plan?.[i]; // consigne de CETTE série (setPlan résolu)
                  const psKg = ps ? (ps.kg != null ? ps.kg : (ps.charge != null ? ps.charge : null)) : null;
                  return (
                    <div key={i} style={{ marginBottom: 5 }}>
                      {ps && (
                        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.6)", margin: "0 0 3px 32px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{t("player.session.seriesN", { n: i + 1 })}</span>
                          <span>{[ps.reps ? `${ps.reps}` : null, ps.pct ? `${ps.pct}%` : null].filter(Boolean).join(" · ")}</span>
                          {psKg != null ? (
                            <span style={{ color: C.viol, fontWeight: 800 }}>→ {psKg} {t("player.session.kg")}</span>
                          ) : ps.needs1RM ? (
                            <button onClick={() => !preview && setSet1rm({ e })} style={{ fontWeight: 800, color: C.amb, background: `${C.amb}18`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "0 6px", cursor: "pointer" }}>{ps.pct}% · {t("player.session.setYour1RM", { movement: e.rmLabel || e.name })}</button>
                          ) : null}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: isSkillEx ? "26px 1fr 34px" : "26px 1fr 1fr 34px", gap: 6, alignItems: "center" }}>
                        <button onClick={() => setSet(e.id, i, { type: nextSetType(x.type) })} title={stype.name} style={{ height: 32, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", color: stype.c, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{stype.l}</button>
                        {!isSkillEx && <input value={x.w} onChange={(ev) => setSet(e.id, i, { w: ev.target.value })} placeholder={ph?.w ? `${ph.w}` : (psKg != null ? `${psKg}` : (pl?.kg != null ? `${pl.kg}` : "kg"))} inputMode="decimal" style={{ ...playInp, opacity: x.done ? 0.6 : 1 }} />}{/* i18n-ok: unité kg */}
                        <input value={x.reps} onChange={(ev) => setSet(e.id, i, { reps: ev.target.value })} placeholder={ph?.reps ? `${ph.reps}` : (isSkillEx ? (e.measure === "temps" ? t("player.session.holdUnit") : (e.reps || "reps")) : (ps?.reps ? `${ps.reps}` : (e.reps || "reps")))} inputMode={isSkillEx && e.measure === "temps" ? "numeric" : undefined} style={{ ...playInp, opacity: x.done ? 0.6 : 1 }} />{/* i18n-ok: placeholder = consigne prescrite (unité adaptée : reps, watts, kcal, min…) */}
                        <button onClick={() => toggleSet(e, i)} style={{ height: 32, borderRadius: 6, border: x.done ? "none" : `1px solid ${C.border}`, background: x.done ? C.green : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <CheckCircle size={15} color={x.done ? "#fff" : "rgba(255,255,255,0.3)"} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button onClick={() => addSet(e.id)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{t("player.session.addSet")}</button>
                  {ex[e.id].sets.length > 1 && <button onClick={() => delSet(e.id, ex[e.id].sets.length - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.56)", fontSize: 10, cursor: "pointer" }}>{t("player.session.removeSet")}</button>}
                </div>
                <textarea
                  value={ex[e.id].note || ""}
                  onChange={(ev) => setExNote(e.id, ev.target.value)}
                  placeholder={ecart ? t("player.session.exNoteGap") : t("player.session.exNote")}
                  style={{ width: "100%", marginTop: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${ecart ? `${C.amb}55` : C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34 }}
                />
              </div>
            );
          })}

          {/* Durée réelle de la séance (min) → alimente la charge (sRPE = RPE × durée) */}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "12px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={13} /> {t("player.session.durationLabel")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <button onClick={() => { setDirty(true); setDur((v) => Math.max(5, (Number(v) || plannedDur) - 5)); }} style={durBtn}>−5</button>
            <div style={{ position: "relative", flex: "0 0 96px" }}>
              <input value={dur} onChange={(ev) => { setDirty(true); setDur(ev.target.value.replace(/[^\d]/g, "")); }} inputMode="numeric" style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 30px 9px 12px", color: "#fff", fontSize: 15, fontWeight: 800, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{t("player.session.min")}</span>
            </div>
            <button onClick={() => { setDirty(true); setDur((v) => Math.min(300, (Number(v) || plannedDur) + 5)); }} style={durBtn}>+5</button>
            {startedAt != null && elapsed > 0 && Number(dur) !== elapsed && (
              <button onClick={() => { setDirty(true); setDur(elapsed); }} style={{ background: `${accent}18`, border: `1px solid ${accent}55`, borderRadius: 8, padding: "7px 10px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{t("player.session.useChrono", { n: elapsed })}</button>
            )}
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
            {t("player.session.durationPlanned", { n: plannedDur })}
            {Number(dur) !== plannedDur ? ` · ${t("player.session.durationReal", { n: Number(dur) || plannedDur })}` : ""}
          </div>

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "12px 0 8px" }}>{t("player.session.rpeLabel")}</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} onClick={() => { setDirty(true); setRpe(n); }} style={{ flex: 1, height: 32, borderRadius: 6, background: rpe === n ? (n <= 3 ? C.green : n <= 6 ? C.amb : C.coral) : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, cursor: "pointer", border: rpe === n ? "2px solid rgba(255,255,255,0.4)" : "2px solid transparent" }}>{n}</div>
            ))}
          </div>
          <textarea value={fb} onChange={(e) => { setDirty(true); setFb(e.target.value); }} placeholder={t("player.session.feedbackPlaceholder")} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "none", height: 50, marginBottom: 10 }} />
          {preview ? (
            <div style={{ textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700 }}>
              {t("player.session.previewSession")}
            </div>
          ) : (
            <>
              <button onClick={() => submit("done")} disabled={busy} style={{ width: "100%", background: C.green, border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1, marginBottom: 8 }}>
                <CheckCircle size={13} />{st === "done" ? t("player.session.update") : t("player.session.finish")}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => submit("missed")} disabled={busy} style={{ flex: 1, background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 8, padding: "10px", color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("player.session.missed")}</button>
                <button onClick={() => submit("postponed")} disabled={busy} title={t("player.session.postponeTitle")} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("player.session.postpone")}</button>
              </div>
            </>
          )}
          {!preview && s.origin === "libre" && onDelete && (
            <button onClick={() => onDelete(s)} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
              {t("player.session.deleteFree")}
            </button>
          )}
        </div>
      )}

      {graphEx && <ExoProgressModal pid={me.id} exName={graphEx} sessions={sessions} logs={logs} accent={accent} onClose={() => setGraphEx(null)} />}
      {proto && <ProgramView id={proto.id} doc={proto.doc} title={proto.title} onClose={() => setProto(null)} />}
      {infoEx && <ExerciseInfoModal name={infoEx} onClose={() => setInfoEx(null)} />}
      {set1rm && !preview && <Quick1RM e={set1rm.e} current={exOneRM(set1rm.e)} me={me} t={t} onSaved={(kg) => applyOneRM(set1rm.e, kg)} onClose={() => setSet1rm(null)} />}
    </div>
  );
}

/* Saisie / correction rapide, par le JOUEUR, de son 1RM pour un mouvement, SANS
   quitter la séance. Choix 1RM (direct) ou 5RM (converti en 1RM estimé via Epley).
   Écrit dans la FICHE (add1RM, source unique) ; `onSaved(kg)` transmet le 1RM
   résultant pour pré-remplir la charge des séries vides de l'exercice. */
export function Quick1RM({ e, current, me, t, onSaved, onClose }) {
  const label = e.rmLabel || e.name;
  const [mode, setMode] = useState("1rm"); // 1rm (direct) | 5rm (sous-max → Epley)
  const [v, setV] = useState(current != null ? String(current) : "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const val = Number(v);
    if (!(val > 0)) return;
    setBusy(true);
    try {
      const oneRMkg = mode === "5rm" ? e1RM(val, 5) : val; // Epley pour le 5RM
      await add1RM(me.team, me.id, {
        name: label, exerciseId: e.rmExerciseId || null,
        valueKg: mode === "1rm" ? val : null,
        testWeight: mode === "5rm" ? val : null,
        testReps: mode === "5rm" ? 5 : null,
        source: "player",
      });
      onSaved && onSaved(oneRMkg);
      onClose();
    } catch (err) { console.error("[quick1rm]", err.message); setBusy(false); }
  };
  const pill = (on) => ({ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: on ? C.viol : "rgba(255,255,255,0.07)", color: "#fff" });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: C.panel, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{t(current != null ? "player.session.edit1rmTitle" : "player.session.set1rmTitle", { movement: label })}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>{mode === "5rm" ? t("player.session.rm5rmHint") : t("player.session.set1rmHint")}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setMode("1rm")} style={pill(mode === "1rm")}>{t("player.session.rm1rm")}</button>
          <button onClick={() => setMode("5rm")} style={pill(mode === "5rm")}>{t("player.session.rm5rm")}</button>
        </div>
        <input value={v} onChange={(ev) => setV(ev.target.value)} inputMode="decimal" autoFocus placeholder={t("oneRM.kg")} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", textAlign: "center", marginBottom: 12, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, background: C.green, border: "none", borderRadius: 9, padding: 11, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("player.session.set1rmSave")}</button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 9, padding: "11px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/* Vidéo de démonstration d'un exercice (#1). Lecteur YouTube intégré à la
   demande (iframe) ; sinon lien cliquable brut (autre hébergeur). Rien à
   afficher si l'exercice n'a pas de lien exploitable. */
export function ExerciseVideo({ url, accent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const embed = youtubeEmbed(url);
  const href = safeVideoUrl(url);
  if (!href) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {embed ? (
          <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "5px 10px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            <Video size={13} /> {open ? t("player.session.hideVideo") : t("player.session.showDemo")}
          </button>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "5px 10px", color: accent, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
            <ExternalLink size={13} /> {t("player.session.seeVideo")}
          </a>
        )}
        {embed && (
          <a href={href} target="_blank" rel="noopener noreferrer" title={t("player.session.openYoutube")} style={{ display: "inline-flex", alignItems: "center", color: "rgba(255,255,255,0.5)" }}>
            <ExternalLink size={13} />
          </a>
        )}
      </div>
      {open && embed && (
        <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", marginTop: 8, borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <iframe
            src={embed}
            title={t("player.session.videoTitle")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}
    </div>
  );
}

// Durée courte lisible : « 30 s » (<60) ou « 1:30 ».
const fmtDurShort = (sec) => { const s = Number(sec) || 0; return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
// Libellé d'un effort/récup { durationSec | distanceM }.
const effLabel = (o) => (o?.distanceM ? `${o.distanceM} m` : o?.durationSec ? fmtDurShort(o.durationSec) : "—");
const cardioBox = (accent) => ({ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 12, marginBottom: 14 });
const cardioInp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 8px", color: "#fff", fontSize: 13, outline: "none", textAlign: "center", boxSizing: "border-box" };

/* C3 — Cardio CONTINU : distance / temps saisis → allure & vitesse réalisées ;
   allure cible depuis %VMA + MAS du joueur (jamais de valeur fausse). */
export function CardioContinuous({ e, st, onField, onNote, masKmh, t, accent }) {
  const m = st?.mono || {};
  const target = computeTargetPace(e.pctVMA, masKmh);
  const realPace = paceSecPerKmFromDistanceTime(m.distanceM, m.durationSec);
  const realSpeed = speedKmhFromDistanceTime(m.distanceM, m.durationSec);
  const dsec = Number(m.durationSec) || 0;
  const setDur = (mn, sc) => onField({ durationSec: Math.max(0, (Number(mn) || 0) * 60 + (Number(sc) || 0)) });
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name || t("player.session.cardio.continuous")}</span>
        <Tag c={accent}>{t("player.session.cardio.continuous")}</Tag>
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
        {t("player.session.cardio.target")} {[e.distanceM ? `${e.distanceM} m` : null, e.durationSec ? fmtDurShort(e.durationSec) : null, e.pctVMA ? `${e.pctVMA}% VMA` : null].filter(Boolean).join(" · ") || "—"}
        {e.pctVMA ? (target.needsMas ? ` · ${t("player.session.cardio.noMas")}` : ` · ${t("player.session.cardio.targetPace", { pace: formatPace(target.secPerKm), speed: formatSpeed(target.speedKmh) })}`) : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <label><span style={miniLbl}>{t("player.session.cardio.distanceM")}</span><input value={m.distanceM ?? ""} onChange={(ev) => onField({ distanceM: ev.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" style={cardioInp} /></label>
        <label><span style={miniLbl}>{t("player.session.cardio.duration")}</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input value={dsec ? Math.floor(dsec / 60) : ""} onChange={(ev) => setDur(ev.target.value.replace(/[^\d]/g, ""), dsec % 60)} inputMode="numeric" placeholder={t("player.session.min")} style={cardioInp} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>:</span>
            <input value={dsec ? String(dsec % 60).padStart(2, "0") : ""} onChange={(ev) => setDur(Math.floor(dsec / 60), ev.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder={t("player.session.ssHint")} style={cardioInp} />
          </div>
        </label>
        <label><span style={miniLbl}>{t("player.session.cardio.hr")}</span><input value={m.hrAvg ?? ""} onChange={(ev) => onField({ hrAvg: ev.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" style={cardioInp} /></label>
      </div>
      {(realPace || realSpeed) && (
        <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8 }}>
          {t("player.session.cardio.realPace", { pace: formatPace(realPace), speed: formatSpeed(realSpeed) })}
        </div>
      )}
      <button onClick={() => onField({ done: !m.done })} style={{ width: "100%", background: m.done ? C.green : "rgba(255,255,255,0.05)", border: m.done ? "none" : `1px solid ${C.border}`, borderRadius: 8, padding: "9px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <CheckCircle size={14} color={m.done ? "#fff" : "rgba(255,255,255,0.4)"} /> {m.done ? t("player.session.cardio.done") : t("player.session.cardio.markDone")}
      </button>
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34, boxSizing: "border-box" }} />
    </div>
  );
}

/* C2 — Cardio INTERVALLES : une ligne cochable par répétition, cible (effort /
   récup / allure %VMA, éventuellement propre à la rép via repPlan) + réalisé. */
export function CardioInterval({ e, st, onRep, onNote, masKmh, t, accent }) {
  const reps = st?.sets || [];
  const specFor = (i) => (Array.isArray(e.repPlan) && e.repPlan[i]) ? e.repPlan[i] : { effort: e.effort, recovery: e.recovery, pctVMA: e.pctVMA };
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name || t("player.session.cardio.interval")}</span>
        <Tag c={accent}>{t("player.session.cardio.interval")}</Tag>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{reps.length} × {effLabel(e.effort)}{e.recovery ? ` / ${effLabel(e.recovery)}` : ""}</span>
      </div>
      {reps.map((x, i) => {
        const sp = specFor(i);
        const tp = computeTargetPace(sp.pctVMA, masKmh);
        const unit = sp.effort?.distanceM ? "m" : "s";
        return (
          <div key={i} style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.6)", margin: "0 0 3px 2px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{t("player.session.seriesN", { n: i + 1 })}</span>
              <span>{effLabel(sp.effort)}{sp.recovery ? ` / ${effLabel(sp.recovery)}` : ""}</span>
              {sp.pctVMA ? (tp.needsMas ? <span style={{ color: C.amb }}>{sp.pctVMA}% · {t("player.session.cardio.noMas")}</span> : <span style={{ color: C.viol, fontWeight: 700 }}>{sp.pctVMA}% · {t("player.session.cardio.pacePerKm", { pace: formatPace(tp.secPerKm) })}</span>) : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 34px", gap: 6, alignItems: "center" }}>
              <input value={x.actual ?? ""} onChange={(ev) => onRep(i, { actual: ev.target.value })} placeholder={t("player.session.cardio.realizedUnit", { unit })} style={{ ...cardioInp, textAlign: "left", opacity: x.done ? 0.6 : 1 }} />
              <button onClick={() => onRep(i, { done: !x.done })} style={{ height: 32, borderRadius: 6, border: x.done ? "none" : `1px solid ${C.border}`, background: x.done ? C.green : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <CheckCircle size={15} color={x.done ? "#fff" : "rgba(255,255,255,0.3)"} />
              </button>
            </div>
          </div>
        );
      })}
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={{ width: "100%", marginTop: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34, boxSizing: "border-box" }} />
    </div>
  );
}
const miniLbl = { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, display: "block", marginBottom: 3 };

/* C4 — Circuit / AMRAP : compteur de tours réalisés. */
export function CardioCircuit({ e, st, onField, onNote, t, accent }) {
  const m = st?.mono || {};
  const rounds = Number(m.roundsDone) || 0;
  const step = (d) => onField({ roundsDone: Math.max(0, rounds + d), done: true });
  const items = Array.isArray(e.roundItems) ? e.roundItems : [];
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name || t(`player.session.cardio.mode_${e.mode || "circuit"}`)}</span>
        <Tag c={accent}>{t(`player.session.cardio.mode_${e.mode || "circuit"}`)}</Tag>
        {e.totalDurationSec ? <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{fmtDurShort(e.totalDurationSec)}</span> : null}
      </div>
      {items.length > 0 && (
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
          {items.map((it) => `${it.name}${it.reps ? ` ×${it.reps}` : it.sec ? ` ${fmtDurShort(it.sec)}` : ""}`).join(" · ")}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
        <button onClick={() => step(-1)} style={{ ...durBtn, width: 40, height: 40 }}>−</button>
        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: accent }}>{rounds}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{t("player.session.cardio.rounds")}</div>
        </div>
        <button onClick={() => step(1)} style={{ ...durBtn, width: 40, height: 40 }}>+</button>
      </div>
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34, boxSizing: "border-box" }} />
    </div>
  );
}

/* C5 — Test : saisie du résultat (valeur + unité de la batterie) ; deep-link vers
   la Fiche. On stocke le résultat dans le log ; test_results reste saisi par le staff. */
export function CardioTest({ e, st, onField, onNote, onNavigate, t, accent }) {
  const m = st?.mono || {};
  const meta = testMeta(e.testKey);
  const unit = (meta?.unit || "").trim();
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>🧪</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{meta?.label || e.name || t("player.session.testTag")}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 34px", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <input value={m.value ?? ""} onChange={(ev) => onField({ value: ev.target.value })} placeholder={t("player.session.cardio.result")} style={{ ...cardioInp, textAlign: "left" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{unit || "—"}</span>{/* i18n-ok: unité issue de la batterie */}
        <button onClick={() => onField({ done: !m.done })} style={{ height: 32, borderRadius: 6, border: m.done ? "none" : `1px solid ${C.border}`, background: m.done ? C.green : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <CheckCircle size={15} color={m.done ? "#fff" : "rgba(255,255,255,0.3)"} />
        </button>
      </div>
      {onNavigate && (
        <button onClick={() => onNavigate("fiche")} style={{ background: `${accent}18`, border: `1px solid ${accent}55`, borderRadius: 7, padding: "6px 10px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <ExternalLink size={13} /> {t("player.session.cardio.reportTest")}
        </button>
      )}
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34, boxSizing: "border-box" }} />
    </div>
  );
}

// Ligne « consigne » d'un effort (rappel de la prescription brute du coach).
function EffortPresc({ presc, t }) {
  if (!presc) return null;
  return (
    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
      <span style={{ fontWeight: 700 }}>{t("player.session.effort.target")}</span> {presc}
    </div>
  );
}
// Bouton « fait ✓ » commun aux efforts mono.
function EffortDone({ done, onToggle, t }) {
  return (
    <button onClick={onToggle} style={{ width: "100%", background: done ? C.green : "rgba(255,255,255,0.05)", border: done ? "none" : `1px solid ${C.border}`, borderRadius: 8, padding: "9px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <CheckCircle size={14} color={done ? "#fff" : "rgba(255,255,255,0.4)"} /> {done ? t("player.session.effort.done") : t("player.session.effort.markDone")}
    </button>
  );
}
const effNoteStyle = { width: "100%", marginTop: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34, boxSizing: "border-box" };
const onlyDigits = (v) => String(v).replace(/[^\d]/g, "");

/* Effort CONDITIONING (mono) : temps / distance / watts / kcal / FC. Allure &
   vitesse réalisées calculées depuis distance+temps ; allure cible depuis %VMA
   + MAS du joueur (jamais de valeur fausse). Aucune charge kg / %1RM. */
export function EffortConditioning({ e, st, onField, onNote, masKmh, t, accent }) {
  const m = st?.mono || {};
  const target = computeTargetPace(e.pctVMA, masKmh);
  const realPace = paceSecPerKmFromDistanceTime(m.distanceM, m.durationSec);
  const realSpeed = speedKmhFromDistanceTime(m.distanceM, m.durationSec);
  const dsec = Number(m.durationSec) || 0;
  const setDur = (mn, sc) => onField({ durationSec: Math.max(0, (Number(mn) || 0) * 60 + (Number(sc) || 0)) });
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
        <Tag c={accent}>{t("player.session.effort.conditioning")}</Tag>
      </div>
      <EffortPresc presc={e.presc} t={t} />
      {e.pctVMA ? (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
          {`${e.pctVMA}% VMA · ${target.needsMas ? t("player.session.cardio.noMas") : t("player.session.cardio.targetPace", { pace: formatPace(target.secPerKm), speed: formatSpeed(target.speedKmh) })}`}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <label><span style={miniLbl}>{t("player.session.effort.distanceM")}</span><input value={m.distanceM ?? ""} onChange={(ev) => onField({ distanceM: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
        <label><span style={miniLbl}>{t("player.session.effort.duration")}</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input value={dsec ? Math.floor(dsec / 60) : ""} onChange={(ev) => setDur(onlyDigits(ev.target.value), dsec % 60)} inputMode="numeric" placeholder={t("player.session.min")} style={cardioInp} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>:</span>
            <input value={dsec ? String(dsec % 60).padStart(2, "0") : ""} onChange={(ev) => setDur(Math.floor(dsec / 60), onlyDigits(ev.target.value))} inputMode="numeric" placeholder={t("player.session.ssHint")} style={cardioInp} />
          </div>
        </label>
        <label><span style={miniLbl}>{t("player.session.effort.hr")}</span><input value={m.hrAvg ?? ""} onChange={(ev) => onField({ hrAvg: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <label><span style={miniLbl}>{t("player.session.effort.watts")}</span><input value={m.watts ?? ""} onChange={(ev) => onField({ watts: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
        <label><span style={miniLbl}>{t("player.session.effort.kcal")}</span><input value={m.kcal ?? ""} onChange={(ev) => onField({ kcal: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
      </div>
      {(realPace || realSpeed) && (
        <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8 }}>
          {t("player.session.cardio.realPace", { pace: formatPace(realPace), speed: formatSpeed(realSpeed) })}
        </div>
      )}
      <EffortDone done={!!m.done} onToggle={() => onField({ done: !m.done })} t={t} />
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={effNoteStyle} />
    </div>
  );
}

/* Effort VITESSE (mono) : distance / temps / répétitions / récup. Sprints courts
   → temps en secondes. Vitesse réalisée calculée depuis distance+temps. Pas de kg. */
export function EffortSpeed({ e, st, onField, onNote, t, accent }) {
  const m = st?.mono || {};
  const realSpeed = speedKmhFromDistanceTime(m.distanceM, m.durationSec);
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
        <Tag c={accent}>{t("player.session.effort.vitesse")}</Tag>
      </div>
      <EffortPresc presc={e.presc} t={t} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <label><span style={miniLbl}>{t("player.session.effort.distanceM")}</span><input value={m.distanceM ?? ""} onChange={(ev) => onField({ distanceM: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
        <label><span style={miniLbl}>{t("player.session.effort.duration")} (s)</span><input value={m.durationSec ?? ""} onChange={(ev) => onField({ durationSec: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>{/* i18n-ok: unité s (secondes) */}
        <label><span style={miniLbl}>{t("player.session.effort.reps")}</span><input value={m.reps ?? ""} onChange={(ev) => onField({ reps: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
        <label><span style={miniLbl}>{t("player.session.effort.recovery")}</span><input value={m.recoverySec ?? ""} onChange={(ev) => onField({ recoverySec: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
      </div>
      {realSpeed ? <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8 }}>{t("player.session.effort.speed", { speed: formatSpeed(realSpeed) })}</div> : null}
      <EffortDone done={!!m.done} onToggle={() => onField({ done: !m.done })} t={t} />
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={effNoteStyle} />
    </div>
  );
}

/* Effort MOBILITÉ / récupération (mono) : durée totale / tenue / nb tenues. Pas de kg. */
export function EffortMobility({ e, st, onField, onNote, t, accent }) {
  const m = st?.mono || {};
  const dsec = Number(m.durationSec) || 0;
  const setDur = (mn, sc) => onField({ durationSec: Math.max(0, (Number(mn) || 0) * 60 + (Number(sc) || 0)) });
  return (
    <div style={cardioBox(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
        <Tag c={accent}>{t("player.session.effort.mobility")}</Tag>
      </div>
      <EffortPresc presc={e.presc} t={t} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <label><span style={miniLbl}>{t("player.session.effort.durationTotal")}</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input value={dsec ? Math.floor(dsec / 60) : ""} onChange={(ev) => setDur(onlyDigits(ev.target.value), dsec % 60)} inputMode="numeric" placeholder={t("player.session.min")} style={cardioInp} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>:</span>
            <input value={dsec ? String(dsec % 60).padStart(2, "0") : ""} onChange={(ev) => setDur(Math.floor(dsec / 60), onlyDigits(ev.target.value))} inputMode="numeric" placeholder={t("player.session.ssHint")} style={cardioInp} />
          </div>
        </label>
        <label><span style={miniLbl}>{t("player.session.effort.hold")}</span><input value={m.holdSec ?? ""} onChange={(ev) => onField({ holdSec: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
        <label><span style={miniLbl}>{t("player.session.effort.holds")}</span><input value={m.holds ?? ""} onChange={(ev) => onField({ holds: onlyDigits(ev.target.value) })} inputMode="numeric" style={cardioInp} /></label>
      </div>
      <EffortDone done={!!m.done} onToggle={() => onField({ done: !m.done })} t={t} />
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={effNoteStyle} />
    </div>
  );
}

// Une barre horizontale de comparaison (valeur rapportée au max de la vue).
function CmpBar({ label, sub, value, max, color, unit }) {
  const pct = value > 0 && max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{label}{sub ? <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}> · {sub}</span> : null}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{value != null ? `${value} ${unit}` : "—"}</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width .3s" }} />
      </div>
    </div>
  );
}

/* Vue joueur d'un exercice : progression personnelle (issue de exercise_perf,
   donc du réalisé) + comparaison ANONYMISÉE moi / ma ligne / mon équipe. Les
   moyennes ligne/équipe ne sont renvoyées par le serveur qu'à partir de 5
   joueurs (k-anonymat) ; en deçà, on affiche un message, jamais de valeur. */
export function ExoProgressModal({ pid, exName, sessions, logs, accent, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const { series, agg, loading } = useExercisePerf(exName, true);

  // Série personnelle depuis exercise_perf ; repli sur l'historique client
  // (compatibilité d'anciens logs) si le serveur ne renvoie rien.
  const srvPts = (series || []).map((s) => s.est1rm || s.topKg || 0).filter((v) => v > 0);
  const hist = exerciseHistory(logs, sessions, pid, exName);
  const pts = srvPts.length >= 2 ? srvPts : hist.map((h) => h.best1rm || h.top);
  const rec = series && series.length
    ? { top: Math.max(0, ...series.map((s) => s.topKg || 0)), oneRM: Math.max(0, ...series.map((s) => s.est1rm || 0)) }
    : { top: Math.max(0, ...hist.map((h) => h.top)), oneRM: Math.max(0, ...hist.map((h) => h.best1rm)) };

  const me = agg?.me;
  const lineAgg = agg?.lineAgg;
  const teamAgg = agg?.teamAgg;
  const cmpMax = Math.max(me?.orm || 0, lineAgg?.orm || 0, teamAgg?.orm || 0);
  const hasCmp = (me?.orm || 0) > 0 && (lineAgg || teamAgg);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, background: C.panel, borderRadius: 18, padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ fontSize: 15, fontWeight: 800 }}>{exName}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("player.session.progressSub")}</div></div>
          <CloseX onClose={onClose} />
        </div>

        {pts.length >= 2 ? (
          <>
            <LineChart pts={pts} color={accent} height={130} />
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.amb }}>{rec.top}<span style={{ fontSize: 11 }}>{t("player.session.kg")}</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{t("player.session.recordLoad")}</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{rec.oneRM}<span style={{ fontSize: 11 }}>{t("player.session.kg")}</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{t("player.session.estimated1rm")}</div></div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{t("player.session.notEnoughHistory")}</div>
        )}

        {/* Comparaison anonymisée */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Users size={13} style={{ color: "rgba(255,255,255,0.7)" }} />
            <span style={{ fontSize: 12, fontWeight: 800 }}>{t("player.session.cmpTitle")}</span>
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>{t("player.session.cmpSub")}</div>

          {loading && !agg ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", padding: "8px 0" }}>{t("common.loading")}</div>
          ) : hasCmp ? (
            <>
              <CmpBar label={t("player.session.cmpMe")} value={me.orm} max={cmpMax} color={accent} unit={t("player.session.kg")} />
              {lineAgg
                ? <CmpBar label={t("player.session.cmpLine")} sub={t("player.session.cmpPlayers", { count: lineAgg.n })} value={lineAgg.orm} max={cmpMax} color={C.teal} unit={t("player.session.kg")} />
                : <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{t("player.session.cmpLine")} — {t("player.session.cmpKanon")}</div>}
              {teamAgg
                ? <CmpBar label={t("player.session.cmpTeam")} sub={t("player.session.cmpPlayers", { count: teamAgg.n })} value={teamAgg.orm} max={cmpMax} color={C.viol} unit={t("player.session.kg")} />
                : <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t("player.session.cmpTeam")} — {t("player.session.cmpKanon")}</div>}
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{t("player.session.cmpBasis")}</div>
            </>
          ) : (me?.orm || 0) > 0 ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{t("player.session.cmpKanonFull")}</div>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("player.session.cmpNoData")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
