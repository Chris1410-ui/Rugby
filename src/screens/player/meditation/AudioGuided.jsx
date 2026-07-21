import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { vibe, fmtClock } from "./medTimer.js";

/* Séance PILOTÉE PAR L'AUDIO : ici la VOIX enregistrée guide tout le déroulé
   (respirations, blocage/contraction, relâchement). Le visuel ne se lance PAS
   sur un minuteur propre — il SUIT la position de lecture de l'audio :
   - le cercle respire au rythme de la lecture (fige à la pause, reprend, se
     termine avec l'audio) ;
   - la séance se termine quand l'audio se termine (→ récompense).
   Aucune désynchronisation possible : il n'y a plus d'horloge concurrente. */
const IN = 5.5, OUT = 5.5;            // rythme d'ambiance du cercle (s) — accompagnement
const MIN = 0.5, MAX = 1;
const lerp = (a, b, t) => a + (b - a) * t;

export default function AudioGuided({ src, running, onFinish, accent }) {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const circleRef = useRef(null);
  const glowRef = useRef(null);
  const rafRef = useRef(0);
  const lastBreath = useRef(-1);
  const finished = useRef(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [err, setErr] = useState(false);

  // Lecture/pause suit l'état `running` (boutons Démarrer/Pause/Stop du Player).
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (running) a.play?.().catch(() => { /* autoplay bloqué → l'utilisateur relance */ });
    else { a.pause?.(); vibe(0); }
  }, [running]);

  // Boucle d'animation : le cercle est fonction de audio.currentTime → il SUIT
  // strictement la lecture (immobile tant que l'audio ne joue pas).
  useEffect(() => {
    const loop = () => {
      const a = audioRef.current;
      if (a) {
        const ct = a.currentTime || 0;
        setCur(ct);
        const cyc = IN + OUT;
        const p = ((ct % cyc) + cyc) % cyc;
        const scale = p < IN ? lerp(MIN, MAX, p / IN) : lerp(MAX, MIN, (p - IN) / OUT);
        if (circleRef.current) circleRef.current.style.transform = `scale(${scale.toFixed(3)})`;
        if (glowRef.current) glowRef.current.style.opacity = String((0.25 + (scale - MIN) / (MAX - MIN) * 0.5).toFixed(3));
        // Pulsation haptique légère à chaque inspiration (si l'audio avance).
        const bi = Math.floor(ct / cyc);
        if (running && !a.paused && bi !== lastBreath.current) { lastBreath.current = bi; vibe(45); }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); vibe(0); };
  }, [running]);

  const onEnded = () => { if (!finished.current) { finished.current = true; vibe(0); onFinish?.(); } };
  const label = running ? t("meditation.contraction.audioLead") : t("meditation.contraction.audioReady");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", width: "100%" }}>
      <audio ref={audioRef} src={src} preload="auto" onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)} onEnded={onEnded} onError={() => setErr(true)} />

      <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div ref={glowRef} style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${accent}88 0%, ${accent}00 70%)`, filter: "blur(6px)", transition: "opacity .12s linear", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: `1px solid ${accent}22` }} />
        <div ref={circleRef} style={{ width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle at 50% 40%, ${accent}cc, ${accent}55 70%, ${accent}22)`, border: `2px solid ${accent}`, boxShadow: `0 0 32px ${accent}55, inset 0 0 40px ${accent}44`, willChange: "transform", transform: `scale(${MIN})` }} />
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 34, marginBottom: 2 }}>🎧</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{fmtClock(cur)}{dur ? ` / ${fmtClock(dur)}` : ""}</div>
        </div>
      </div>

      {/* Barre de progression = position dans l'audio (le guide). */}
      <div style={{ width: 260, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", marginTop: 14 }}>
        <div style={{ height: "100%", width: `${dur ? Math.min(100, (cur / dur) * 100) : 0}%`, background: accent, transition: "width .2s linear" }} />
      </div>

      <div style={{ marginTop: 12, textAlign: "center", minHeight: 34, maxWidth: 320, fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
        {err ? t("meditation.contraction.audioMissing") : label}
      </div>
    </div>
  );
}
