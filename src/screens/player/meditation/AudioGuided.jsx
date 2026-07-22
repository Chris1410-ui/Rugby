import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { vibe, fmtClock } from "./medTimer.js";
import { createAmbience, AMBIENCE_THEMES } from "./ambience.js";

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
const THEME_EMOJI = { forest: "🌲", waves: "🌊", rain: "🌧️", fire: "🔥" };

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
  // Voix guidée : gain 0..VOICE_MAX. Boostable AU-DELÀ de 100 % (l'enregistrement
  // est faible) via un gain Web Audio + limiteur ; l'élément <audio> plafonne à 1.
  const [voiceVol, setVoiceVol] = useState(1.8);
  const [theme, setTheme] = useState("forest");     // thème d'ambiance choisi
  const [ambVol, setAmbVol] = useState(0.35);       // volume du fond d'ambiance (0..1)
  const ambRef = useRef(null);
  if (!ambRef.current) ambRef.current = createAmbience("forest", 0.35);
  const ambVolRef = useRef(0.35); ambVolRef.current = ambVol;
  const runningRef = useRef(false); runningRef.current = running;
  const voiceVolRef = useRef(1.8); voiceVolRef.current = voiceVol;
  const vCtxRef = useRef(null), vGainRef = useRef(null), vBuiltRef = useRef(false);

  // Chaîne Web Audio de la voix : source(élément) → gain (boost) → limiteur →
  // sortie. Permet de dépasser 100 % sans saturer. Créée une seule fois, sous
  // geste utilisateur. Retombe sur l'élément <audio> (≤100 %) si indisponible
  // (ex. lecture inter-origine sans CORS).
  const buildVoiceChain = () => {
    const a = audioRef.current; if (!a) return false;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try {
      const ctx = new AC();
      const srcNode = ctx.createMediaElementSource(a);
      const g = ctx.createGain(); g.gain.value = voiceVolRef.current;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25;
      srcNode.connect(g).connect(comp).connect(ctx.destination);
      a.volume = 1; // le gain pilote le volume ; l'élément reste à fond
      vCtxRef.current = ctx; vGainRef.current = g; vBuiltRef.current = true;
      return true;
    } catch { return false; }
  };

  // Lecture/pause suit l'état `running` (boutons du Player). Le fond d'ambiance
  // démarre/s'arrête avec la voix (démarré sous le geste utilisateur → autorisé).
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (running) {
      if (!vBuiltRef.current) { if (!buildVoiceChain()) a.volume = Math.min(1, voiceVolRef.current); }
      vCtxRef.current?.resume?.();
      a.play?.().catch(() => { /* autoplay bloqué → relance manuelle */ });
      ambRef.current?.start(); ambRef.current?.setVolume(ambVolRef.current);
    } else { a.pause?.(); vibe(0); ambRef.current?.pause(); }
  }, [running]);

  // Changement de thème : on arrête l'ancien fond et on recrée le nouveau (au
  // même volume), en le relançant si la séance est en cours.
  useEffect(() => {
    ambRef.current?.stop();
    ambRef.current = createAmbience(theme, ambVolRef.current);
    if (runningRef.current) { ambRef.current.start(); ambRef.current.setVolume(ambVolRef.current); }
  }, [theme]);

  // Volume de la voix réglable à chaud : gain Web Audio si dispo (boost >100 %),
  // sinon volume de l'élément (plafonné à 100 %).
  useEffect(() => {
    const g = vGainRef.current, ctx = vCtxRef.current;
    if (g && ctx) g.gain.setTargetAtTime(voiceVol, ctx.currentTime, 0.08);
    else { const a = audioRef.current; if (a) a.volume = Math.min(1, voiceVol); }
  }, [voiceVol]);

  // Volume de l'ambiance réglable à chaud + arrêt propre au démontage.
  useEffect(() => { ambRef.current?.setVolume(ambVol); }, [ambVol]);
  useEffect(() => () => { ambRef.current?.stop(); try { vCtxRef.current?.close?.(); } catch { /* noop */ } }, []);

  // Se placer où l'on veut dans l'audio (le visuel suit, piloté par currentTime).
  const seek = (v) => { const a = audioRef.current; if (a) { try { a.currentTime = v; setCur(v); lastIdx.current = -1; } catch { /* noop */ } } };

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

  const onEnded = () => { if (!finished.current) { finished.current = true; vibe(0); ambRef.current?.pause(); onFinish?.(); } };
  const holding = phase === "hold";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", width: "100%" }}>
      <audio ref={audioRef} src={src} preload="auto" crossOrigin="anonymous"
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

      {/* Barre de position : glisse pour te placer où tu veux dans l'audio. */}
      <div style={{ width: 280, marginTop: 14 }}>
        <input type="range" min={0} max={dur || 0} step={0.5} value={Math.min(cur, dur || 0)} disabled={!dur}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t("meditation.contraction.seek")}
          style={{ width: "100%", accentColor: accent, cursor: dur ? "pointer" : "default" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
          <span>{fmtClock(cur)}</span><span>{dur ? fmtClock(dur) : "—"}</span>
        </div>
      </div>

      {/* Volume de la voix guidée (boostable au-delà de 100 %). 0 = coupée. */}
      <div style={{ width: 280, marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 15 }} title={t("meditation.contraction.voice")}>🔊</span>
        <input type="range" min={0} max={3.5} step={0.05} value={voiceVol}
          onChange={(e) => setVoiceVol(Number(e.target.value))}
          aria-label={t("meditation.contraction.voice")}
          style={{ flex: 1, accentColor: accent, cursor: "pointer" }} />
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", minWidth: 34, textAlign: "right" }}>{Math.round(voiceVol * 100)}%</span>
      </div>

      {/* Choix du thème d'ambiance (masque la friture). */}
      <div style={{ width: 280, marginTop: 12, display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        {AMBIENCE_THEMES.map((id) => {
          const on = id === theme;
          return (
            <button key={id} type="button" onClick={() => setTheme(id)}
              aria-pressed={on} title={t(`meditation.contraction.theme.${id}`)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: on ? `${C.teal}22` : "rgba(255,255,255,0.06)", border: `1px solid ${on ? C.teal : C.border}`, borderRadius: 999, padding: "5px 11px", color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
              <span style={{ fontSize: 14 }}>{THEME_EMOJI[id]}</span>{t(`meditation.contraction.theme.${id}`)}
            </button>
          );
        })}
      </div>

      {/* Volume du thème sélectionné. 0 = coupé. */}
      <div style={{ width: 280, marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 15 }} title={t("meditation.contraction.ambience")}>{THEME_EMOJI[theme]}</span>
        <input type="range" min={0} max={1} step={0.02} value={ambVol}
          onChange={(e) => setAmbVol(Number(e.target.value))}
          aria-label={t("meditation.contraction.ambience")}
          style={{ flex: 1, accentColor: C.teal, cursor: "pointer" }} />
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", minWidth: 30, textAlign: "right" }}>{Math.round(ambVol * 100)}%</span>
      </div>

      {/* Consigne courte synchronisée sur la phase. */}
      <div key={phase} style={{ marginTop: 12, textAlign: "center", minHeight: 34, maxWidth: 320, fontSize: 13.5, fontWeight: 600, color: holding ? C.coral : "rgba(255,255,255,0.78)", lineHeight: 1.5, animation: "medFade .4s ease" }}>
        {err ? t("meditation.contraction.audioMissing") : t(`meditation.contraction.phase.${phase}`)}
      </div>
    </div>
  );
}
