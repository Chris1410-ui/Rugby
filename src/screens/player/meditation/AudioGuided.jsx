import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { vibe, fmtClock } from "./medTimer.js";
import { createOceanWaves } from "./waves.js";

/* Séance PILOTÉE PAR L'AUDIO, synchronisée PHASE PAR PHASE sur une cue sheet
   (timestamps extraits de l'enregistrement). L'unique source de temps est
   audio.currentTime → le visuel SUIT strictement la voix (fige à la pause,
   reprend, se termine avec l'audio). Aucun minuteur concurrent.
   Comportement par type de phase :
     inhale  → le cercle grandit (MIN→MAX) sur la durée de la phase
     exhale  → le cercle rétrécit (MAX→MIN)
     hold    → figé plein + throb rouge + COMPTE À REBOURS + vibration intense
     release → détente (teal), longue décrue
     intro/prepare/outro → respiration d'ambiance lente
   OFFSET : décalage global (s) si un retard/avance constant apparaît. */
const MIN = 0.5, MAX = 1;
const OFFSET = 0;
const lerp = (a, b, t) => a + (b - a) * t;
const colorFor = (type, accent) => (type === "hold" ? C.coral : type === "release" || type === "outro" ? C.teal : accent);

// Vibration couvrant ~sec s de contraction, intensifiée sur la 2ᵉ moitié.
function holdVibe(sec) {
  const half = Math.floor(sec / 2), pat = [];
  for (let i = 0; i < half; i++) pat.push(820, 180);
  for (let i = 0; i < Math.max(0, sec - half); i++) pat.push(940, 60);
  return pat;
}

export default function AudioGuided({ src, cues, running, onFinish, accent }) {
  const { t } = useTranslation();
  const audioRef = useRef(null), circleRef = useRef(null), glowRef = useRef(null), rafRef = useRef(0);
  const finished = useRef(false), lastIdx = useRef(-1), durRef = useRef(0);
  const paintRef = useRef(() => {});
  const [cur, setCur] = useState(0), [dur, setDur] = useState(0), [err, setErr] = useState(false);
  const [phase, setPhase] = useState(cues?.[0]?.type || "intro");
  const [count, setCount] = useState(0);
  const [waves, setWaves] = useState(true); // fond de vagues (masque la friture)
  const wavesRef = useRef(null);
  if (!wavesRef.current) wavesRef.current = createOceanWaves();
  const wavesOnRef = useRef(true); wavesOnRef.current = waves;

  // Lecture/pause suit l'état `running` (boutons du Player). Le fond de vagues
  // démarre/s'arrête avec la voix (démarré sous le geste utilisateur → autorisé).
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (running) { a.play?.().catch(() => { /* autoplay bloqué → relance manuelle */ }); wavesRef.current?.start(); wavesRef.current?.setEnabled(wavesOnRef.current); }
    else { a.pause?.(); vibe(0); wavesRef.current?.pause(); }
  }, [running]);

  // Bascule du fond de vagues à chaud + arrêt propre au démontage.
  useEffect(() => { wavesRef.current?.setEnabled(waves); }, [waves]);
  useEffect(() => () => { wavesRef.current?.stop(); }, []);

  // Peinture (réassignée à chaque rendu → toujours les dernières props/état).
  paintRef.current = () => {
    const a = audioRef.current;
    if (!a || !cues || !cues.length) return;
    const raw = a.currentTime || 0;
    setCur((p) => (Math.abs(p - raw) > 0.05 ? raw : p));
    const time = raw + OFFSET;

    let idx = 0;
    for (let i = 0; i < cues.length; i++) { if (time >= cues[i].t) idx = i; else break; }
    const ph = cues[idx], next = cues[idx + 1];
    const endT = next ? next.t : (durRef.current || ph.t);
    const len = Math.max(0.001, endT - ph.t);
    const frac = Math.min(1, Math.max(0, (time - ph.t) / len));

    let scale;
    if (ph.type === "inhale") scale = lerp(MIN, MAX, frac);
    else if (ph.type === "exhale" || ph.type === "release") scale = lerp(MAX, MIN, frac);
    else if (ph.type === "hold") scale = MAX - 0.025 + 0.025 * Math.abs(Math.sin((time - ph.t) * Math.PI * 3));
    else { const amb = (time % 11) / 11; scale = amb < 0.5 ? lerp(MIN, 0.8, amb / 0.5) : lerp(0.8, MIN, (amb - 0.5) / 0.5); }

    const col = colorFor(ph.type, accent);
    if (circleRef.current) {
      const c = circleRef.current;
      c.style.transform = `scale(${scale.toFixed(3)})`;
      c.style.background = `radial-gradient(circle at 50% 40%, ${col}cc, ${col}55 70%, ${col}22)`;
      c.style.borderColor = col;
      c.style.boxShadow = `0 0 32px ${col}55, inset 0 0 40px ${col}44`;
    }
    if (glowRef.current) {
      let o = 0.25 + (scale - MIN) / (MAX - MIN) * 0.5;
      if (ph.type === "hold") o = 0.6 + 0.35 * Math.abs(Math.sin((time - ph.t) * Math.PI * 4));
      glowRef.current.style.opacity = String(o.toFixed(3));
      glowRef.current.style.background = `radial-gradient(circle, ${col}88 0%, ${col}00 70%)`;
    }

    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      setPhase(ph.type);
      if (running && !a.paused) {
        if (ph.type === "inhale") vibe(60);
        else if (ph.type === "exhale") vibe(40);
        else if (ph.type === "hold") vibe(holdVibe(Math.round(len)));
        else if (ph.type === "release") vibe(0);
      }
      if (ph.type === "end" && !finished.current) { finished.current = true; vibe(0); onFinish?.(); }
    }
    setCount((p) => { const c = ph.type === "hold" ? Math.max(0, Math.ceil(endT - time)) : 0; return p !== c ? c : p; });
  };

  useEffect(() => {
    const loop = () => { paintRef.current(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); vibe(0); };
  }, []);

  const onEnded = () => { if (!finished.current) { finished.current = true; vibe(0); wavesRef.current?.pause(); onFinish?.(); } };
  const holding = phase === "hold";
  const col = colorFor(phase, accent);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", width: "100%" }}>
      <audio ref={audioRef} src={src} preload="auto"
        onLoadedMetadata={(e) => { durRef.current = e.currentTarget.duration || 0; setDur(durRef.current); }}
        onEnded={onEnded} onError={() => setErr(true)} />

      <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div ref={glowRef} style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${accent}88 0%, ${accent}00 70%)`, filter: "blur(6px)", transition: "opacity .12s linear", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: `1px solid ${accent}22` }} />
        <div ref={circleRef} style={{ width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle at 50% 40%, ${accent}cc, ${accent}55 70%, ${accent}22)`, border: `2px solid ${accent}`, boxShadow: `0 0 32px ${accent}55, inset 0 0 40px ${accent}44`, willChange: "transform", transform: `scale(${MIN})` }} />
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          {holding ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{t("meditation.contraction.label.contract")}</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1.05, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{count}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 30, marginBottom: 3 }}>🎧</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{fmtClock(cur)}{dur ? ` / ${fmtClock(dur)}` : ""}</div>
            </>
          )}
        </div>
      </div>

      {/* Progression = position dans l'audio (le guide). */}
      <div style={{ width: 260, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", marginTop: 14 }}>
        <div style={{ height: "100%", width: `${dur ? Math.min(100, (cur / dur) * 100) : 0}%`, background: col, transition: "width .2s linear, background .3s" }} />
      </div>

      {/* Consigne courte synchronisée sur la phase. */}
      <div key={phase} style={{ marginTop: 12, textAlign: "center", minHeight: 34, maxWidth: 320, fontSize: 13.5, fontWeight: 600, color: holding ? C.coral : "rgba(255,255,255,0.78)", lineHeight: 1.5, animation: "medFade .4s ease" }}>
        {err ? t("meditation.contraction.audioMissing") : t(`meditation.contraction.phase.${phase}`)}
      </div>

      {/* Fond de vagues (masque la friture de la voix) — activable/désactivable. */}
      <button onClick={() => setWaves((w) => !w)} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: waves ? `${accent}22` : "rgba(255,255,255,0.06)", border: `1px solid ${waves ? accent : C.border}`, borderRadius: 999, padding: "6px 13px", color: waves ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        🌊 {t("meditation.contraction.waves")} · {waves ? t("meditation.contraction.wavesOn") : t("meditation.contraction.wavesOff")}
      </button>
    </div>
  );
}
