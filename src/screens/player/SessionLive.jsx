import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { RestTimer, CloseX } from "../../lib/ui.jsx";
import { CheckCircle, ChevronLeft, ChevronRight, Trophy, Clock } from "../../lib/icons.jsx";
import { SET_TYPES, nextSetType } from "../../lib/hevy.js";
import { exerciseInputModel, inputModelUsesLoad } from "../../lib/sessionType.js";
import { useSessionLogging } from "./useSessionLogging.js";
import {
  CardioContinuous, CardioInterval, CardioCircuit, CardioTest,
  EffortConditioning, EffortSpeed, EffortMobility,
} from "./SessionPlayCard.jsx";

/* ═══════════════════════════════════════════════════════════════════════════
   SÉANCE LIVE — plein écran (peau maquette Terrain) sur le lecteur set-par-set.
   Nouvelle présentation UNIQUEMENT : tout l'état et les règles viennent du hook
   PARTAGÉ `useSessionLogging` (identique à SessionPlayCard) → pré-remplissage
   1RM/reps, isolation par (exercice, série) et souveraineté de la saisie
   RESTENT INTACTS. Un exercice à la fois, grosses cases à cocher, minuteur de
   repos, passage à l'exercice suivant. Les blocs cardio/effort réutilisent les
   mêmes composants d'entrée que la carte (aucune divergence). ≥44px,
   prefers-reduced-motion hérité des transitions CSS légères. */
export default function SessionLive({ s, me, sessions, logs, log, accent = C.coral, onClose, onSaved, onNavigate }) {
  const { t } = useTranslation();
  const L = useSessionLogging({ s, me, log, sessions, logs, onSaved, active: true });
  const {
    exos, ex, effNature, preview, plannedDur,
    setSet, addSet, delSet, setExNote, setMono, toggleSet,
    rest, setRest, justPR, busy,
    rpe, setRpe, fb, setFb, dur, setDur, setDirty,
    doneSets, totSets, valider,
  } = L;

  const [idx, setIdx] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const n = exos.length;
  const cur = exos[Math.min(idx, Math.max(0, n - 1))];
  const pct = totSets ? Math.round((doneSets / totSets) * 100) : 0;

  const submit = async (status) => {
    const ok = await valider(status);
    if (ok) onClose();
  };

  const go = (d) => setIdx((i) => Math.max(0, Math.min(n - 1, i + d)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 340, background: C.navy, display: "flex", flexDirection: "column" }}>
      {/* Header : fermer · titre · progression */}
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
        <CloseX onClose={onClose} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.titre || t("player.today.session")}</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>{t("player.session.setsCount", { done: doneSets, total: totSets })}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 && totSets ? C.green : accent }}>{pct}%</span>
      </header>
      <div style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: C.green, transition: "width .4s ease" }} />
      </div>

      {/* PR burst (record battu) */}
      {justPR && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${C.amb}22`, border: `1px solid ${C.amb}66`, borderRadius: 9, padding: "8px 12px", margin: "10px 16px 0" }}>
          <Trophy size={15} color={C.amb} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.amb }}>{t("player.session.record", { ex: justPR.ex, w: justPR.w, orm: justPR.orm })}</span>
        </div>
      )}

      {/* Corps : un exercice à la fois */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 20px" }}>
        {!cur ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13, padding: 24 }}>{t("player.today.noSessionToday")}</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{t("player.live.exoOf", { i: Math.min(idx, n - 1) + 1, n })}</span>
            </div>
            <LiveExercise
              e={cur} st={ex[cur.id]} kind={exerciseInputModel(cur, effNature)} accent={accent} me={me} t={t}
              onSet={(i, p) => setSet(cur.id, i, p)} onToggle={(i) => toggleSet(cur, i)}
              onAdd={() => addSet(cur.id)} onDel={(i) => delSet(cur.id, i)}
              onMono={(p) => setMono(cur.id, p)} onNote={(v) => setExNote(cur.id, v)}
              onNavigate={onNavigate}
            />
          </>
        )}
      </div>

      {/* Minuteur de repos (déclenché à la validation d'une série) */}
      {rest && (
        <div style={{ padding: "0 16px" }}>
          <RestTimer key={rest.k} seconds={rest.sec} accent={accent} onDone={() => setRest(null)} />
        </div>
      )}

      {/* Barre basse : navigation exercices + terminer */}
      <footer style={{ padding: "10px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => go(-1)} disabled={idx <= 0} style={navBtn(idx <= 0)}><ChevronLeft size={18} /></button>
        {idx < n - 1 ? (
          <button onClick={() => go(1)} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {t("player.live.nextExo")} <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => setFinishing(true)} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: "none", background: C.green, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CheckCircle size={16} /> {t("player.live.finish")}
          </button>
        )}
        <button onClick={() => go(1)} disabled={idx >= n - 1} style={navBtn(idx >= n - 1)}><ChevronRight size={18} /></button>
      </footer>

      {/* Feuille de fin : durée + RPE + validation (mêmes contrôles que la carte) */}
      {finishing && (
        <FinishSheet
          plannedDur={plannedDur} dur={dur} setDur={setDur} rpe={rpe} setRpe={setRpe}
          fb={fb} setFb={setFb} setDirty={setDirty} busy={busy} preview={preview}
          onValidate={submit} onClose={() => setFinishing(false)} t={t}
        />
      )}
    </div>
  );
}

const navBtn = (disabled) => ({
  flexShrink: 0, width: 48, height: 48, borderRadius: 12,
  border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)",
  color: disabled ? "rgba(255,255,255,0.25)" : "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: disabled ? "default" : "pointer",
});

const liveInp = { minWidth: 0, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "12px 8px", color: "#fff", fontSize: 16, fontWeight: 700, outline: "none", textAlign: "center", width: "100%", boxSizing: "border-box" };

/* Rendu d'UN exercice en mode live. Set-like → grosses lignes de séries ; les
   blocs cardio/effort réutilisent les composants d'entrée de SessionPlayCard. */
function LiveExercise({ e, st, kind, accent, me, t, onSet, onToggle, onAdd, onDel, onMono, onNote, onNavigate }) {
  if (kind === "cardio_continuous") return <CardioContinuous e={e} st={st} onField={onMono} onNote={onNote} masKmh={me.mas} t={t} accent={accent} />;
  if (kind === "cardio_interval") return <CardioInterval e={e} st={st} onRep={onSet} onNote={onNote} masKmh={me.mas} t={t} accent={accent} />;
  if (kind === "cardio_circuit") return <CardioCircuit e={e} st={st} onField={onMono} onNote={onNote} t={t} accent={accent} />;
  if (kind === "cardio_test") return <CardioTest e={e} st={st} onField={onMono} onNote={onNote} onNavigate={onNavigate} t={t} accent={accent} />;
  if (kind === "conditioning") return <EffortConditioning e={e} st={st} onField={onMono} onNote={onNote} masKmh={me.mas} t={t} accent={accent} />;
  if (kind === "vitesse") return <EffortSpeed e={e} st={st} onField={onMono} onNote={onNote} t={t} accent={accent} />;
  if (kind === "mobility") return <EffortMobility e={e} st={st} onField={onMono} onNote={onNote} t={t} accent={accent} />;

  // Set-like : muscu / poids de corps / skill.
  const usesLoad = inputModelUsesLoad(kind);
  const sets = st?.sets || [];
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{e.name}</div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{t("player.session.prescribed")} </span>
        {e.presc || `${e.sets || sets.length}×${e.reps ?? ""}${e.charge ? ` @ ${e.charge}` : ""}`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sets.map((x, i) => {
          const stype = SET_TYPES[x.type] || SET_TYPES.normal;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: usesLoad ? "32px 1fr 1fr 52px" : "32px 1fr 52px", gap: 8, alignItems: "center", background: x.done ? `${C.green}14` : "rgba(255,255,255,0.03)", border: `1px solid ${x.done ? `${C.green}55` : C.border}`, borderRadius: 12, padding: "8px" }}>
              <button onClick={() => onSet(i, { type: nextSetType(x.type) })} title={stype.name} style={{ height: 44, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.06)", color: stype.c, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{stype.l}</button>
              {usesLoad && <input value={x.w} onChange={(ev) => onSet(i, { w: ev.target.value })} inputMode="decimal" placeholder={t("player.session.kg")} style={{ ...liveInp, opacity: x.done ? 0.6 : 1 }} />}
              <input value={x.reps} onChange={(ev) => onSet(i, { reps: ev.target.value })} inputMode="numeric" placeholder={e.reps || t("player.live.reps")} style={{ ...liveInp, opacity: x.done ? 0.6 : 1 }} />
              <button onClick={() => onToggle(i)} aria-pressed={x.done} style={{ height: 44, borderRadius: 8, border: x.done ? "none" : `1px solid ${C.border}`, background: x.done ? C.green : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <CheckCircle size={20} color={x.done ? "#fff" : "rgba(255,255,255,0.3)"} />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={onAdd} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>{t("player.session.addSet")}</button>
        {sets.length > 1 && <button onClick={() => onDel(sets.length - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", minHeight: 44 }}>{t("player.session.removeSet")}</button>}
      </div>
      <textarea value={st?.note || ""} onChange={(ev) => onNote(ev.target.value)} placeholder={t("player.session.exNote")} style={{ width: "100%", marginTop: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 12.5, outline: "none", resize: "none", height: 44, boxSizing: "border-box" }} />
    </div>
  );
}

/* Feuille de fin : durée réelle + RPE global + validation. Réutilise strictement
   les setters du hook (aucune écriture directe). */
function FinishSheet({ plannedDur, dur, setDur, rpe, setRpe, fb, setFb, setDirty, busy, preview, onValidate, onClose, t }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: C.panel, borderRadius: "20px 20px 0 0", padding: "16px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "88%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{t("player.live.finish")}</div>
          <CloseX onClose={onClose} />
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "4px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={13} /> {t("player.session.durationLabel")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <button onClick={() => { setDirty(true); setDur((v) => Math.max(5, (Number(v) || plannedDur) - 5)); }} style={durBtn}>−5</button>
          <div style={{ position: "relative", flex: "0 0 110px" }}>
            <input value={dur} onChange={(ev) => { setDirty(true); setDur(ev.target.value.replace(/[^\d]/g, "")); }} inputMode="numeric" style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 34px 12px 14px", color: "#fff", fontSize: 17, fontWeight: 800, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("player.session.min")}</span>
          </div>
          <button onClick={() => { setDirty(true); setDur((v) => Math.min(300, (Number(v) || plannedDur) + 5)); }} style={durBtn}>+5</button>
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>{t("player.session.durationPlanned", { n: plannedDur })}</div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{t("player.session.rpeLabel")}</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <button key={v} onClick={() => { setDirty(true); setRpe(v); }} style={{ flex: 1, height: 44, borderRadius: 8, background: rpe === v ? (v <= 3 ? C.green : v <= 6 ? C.amb : C.coral) : "rgba(255,255,255,0.07)", border: rpe === v ? "2px solid rgba(255,255,255,0.4)" : "2px solid transparent", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{v}</button>
          ))}
        </div>
        <textarea value={fb} onChange={(e) => { setDirty(true); setFb(e.target.value); }} placeholder={t("player.session.feedbackPlaceholder")} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "none", height: 54, marginBottom: 12, boxSizing: "border-box" }} />

        {preview ? (
          <div style={{ textAlign: "center", padding: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700 }}>{t("player.session.previewSession")}</div>
        ) : (
          <>
            <button onClick={() => onValidate("done")} disabled={busy} style={{ width: "100%", minHeight: 50, background: C.green, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1, marginBottom: 8 }}>
              <CheckCircle size={16} /> {t("player.session.finish")}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onValidate("missed")} disabled={busy} style={{ flex: 1, minHeight: 46, background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 12, color: C.coral, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("player.session.missed")}</button>
              <button onClick={() => onValidate("postponed")} disabled={busy} style={{ flex: 1, minHeight: 46, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("player.session.postpone")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const durBtn = { flexShrink: 0, width: 46, height: 46, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" };
