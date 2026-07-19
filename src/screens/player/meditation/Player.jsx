import { useState } from "react";
import { C } from "../../../lib/tokens.js";
import { ChevronLeft, CheckCircle } from "../../../lib/icons.jsx";
import { useWakeLock } from "./medTimer.js";
import { JACOBSON_GROUPS } from "./sessions.js";
import BreathingCircle from "./BreathingCircle.jsx";
import Jacobson from "./Jacobson.jsx";
import GuidedSteps from "./GuidedSteps.jsx";

/* Lecteur commun à toutes les séances : démarrer / pause / stop, minuteur,
   durée réglable (nombre de cycles pour la respiration), transitions douces,
   et récompense à la fin (via onComplete — +10, une fois par jour, géré en
   amont). Le visuel est remonté (key=runId) à chaque Stop/Recommencer pour
   repartir de zéro ; Pause ne remonte pas (l'horloge se fige). */
const CYCLE_PRESETS = [6, 12, 20, 30];

export default function Player({ session, onClose, onComplete, alreadyDone }) {
  const accent = session.accent || C.viol;
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [cycles, setCycles] = useState(session.cycles || 12);
  useWakeLock(running);

  const start = () => { setFinished(false); setRunId((n) => n + 1); setRunning(true); };
  const toggle = () => setRunning((r) => !r);
  const stop = () => { setRunning(false); setFinished(false); setRunId((n) => n + 1); };
  const onFinish = () => { setRunning(false); setFinished(true); onComplete?.(); };

  const visual = () => {
    const common = { running, onFinish, accent };
    if (session.kind === "breathing") return <BreathingCircle key={runId} pattern={session.pattern} targetCycles={cycles} {...common} />;
    if (session.kind === "jacobson") return <Jacobson key={runId} groups={JACOBSON_GROUPS} contractSec={session.contractSec} releaseSec={session.releaseSec} {...common} />;
    return <GuidedSteps key={runId} steps={session.steps} {...common} />;
  };

  const btn = (bg, extra = {}) => ({ border: "none", borderRadius: 999, cursor: "pointer", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, ...extra, background: bg });
  const started = runId > 0;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: `radial-gradient(120% 70% at 50% -10%, ${accent}2e 0%, ${C.navy} 55%)`, borderRadius: 16, padding: 14 }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button onClick={onClose} aria-label="Retour" style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 9px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}><ChevronLeft size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.title}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{session.subtitle}</div>
        </div>
        {(alreadyDone || finished) && <span title="Déjà fait aujourd'hui" style={{ fontSize: 9.5, fontWeight: 800, color: C.green, background: `${C.green}22`, border: `1px solid ${C.green}66`, borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" }}>fait ✓</span>}
      </div>

      {/* Visualisation */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0", minHeight: 320 }}>
        {finished ? (
          <div style={{ textAlign: "center", animation: "medFade .5s ease" }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: `${C.green}22`, border: `2px solid ${C.green}` }}>
              <CheckCircle size={40} color={C.green} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Séance terminée 🌿</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 5 }}>Prends un instant avant de reprendre ton activité.</div>
          </div>
        ) : visual()}
      </div>

      {/* Réglage durée (respiration) */}
      {session.kind === "breathing" && !finished && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginRight: 2 }}>Cycles :</span>
          {CYCLE_PRESETS.map((n) => (
            <button key={n} onClick={() => !running && setCycles(n)} disabled={running}
              style={{ minWidth: 40, padding: "6px 10px", borderRadius: 9, cursor: running ? "default" : "pointer", fontSize: 12.5, fontWeight: 800,
                background: cycles === n ? accent : "rgba(255,255,255,0.06)", border: `1px solid ${cycles === n ? accent : C.border}`, color: cycles === n ? "#fff" : "rgba(255,255,255,0.7)", opacity: running && cycles !== n ? 0.4 : 1 }}>
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Contrôles */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 4 }}>
        {finished ? (
          <button onClick={start} style={btn(accent, { padding: "13px 26px", fontSize: 14 })}>Recommencer</button>
        ) : !started ? (
          <button onClick={start} style={btn(accent, { padding: "15px 34px", fontSize: 15.5, boxShadow: `0 6px 20px ${accent}66` })}>▶ Démarrer</button>
        ) : (
          <>
            <button onClick={stop} style={btn("rgba(255,255,255,0.08)", { padding: "13px 20px", fontSize: 13.5, border: `1px solid ${C.border}` })}>■ Stop</button>
            <button onClick={toggle} style={btn(accent, { padding: "14px 30px", fontSize: 15, boxShadow: `0 6px 20px ${accent}55` })}>{running ? "❚❚ Pause" : "▶ Reprendre"}</button>
          </>
        )}
      </div>

      <style>{`@keyframes medFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
