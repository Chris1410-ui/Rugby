import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMedClock } from "./medTimer.js";

/* Cercle de respiration guidée. Le cercle grandit à l'inspiration et rétrécit
   à l'expiration, en synchro avec le texte (« Inspire… / Retiens… / Expire… »)
   et un compteur de cycles. Piloté par l'horloge monotone : la position dans le
   cycle est une fonction pure du temps écoulé → pause/reprise sans à-coup.
   Le transform du cercle est écrit dans une ref (fluide, sans re-render). */
const MIN = 0.5, MAX = 1;
const lerp = (a, b, t) => a + (b - a) * t;

export default function BreathingCircle({ pattern, running, targetCycles, onCycle, onFinish, accent }) {
  const { t } = useTranslation();
  const { inhale, hold1, exhale, hold2 } = pattern;
  const cycleLen = Math.max(0.001, inhale + hold1 + exhale + hold2);

  const circleRef = useRef(null);
  const glowRef = useRef(null);
  const lastPhase = useRef(null);
  const lastCycle = useRef(0);
  const finished = useRef(false);
  const [phase, setPhase] = useState("inhale");
  const [count, setCount] = useState(Math.ceil(inhale));
  const [cycles, setCycles] = useState(0);

  // Position dans le cycle → phase, échelle, décompte.
  const compute = (clock) => {
    const done = Math.floor(clock / cycleLen);
    const t = clock - done * cycleLen;
    let ph, scale, remain;
    if (t < inhale) { ph = "inhale"; scale = lerp(MIN, MAX, t / inhale); remain = inhale - t; }
    else if (t < inhale + hold1) { ph = "hold1"; scale = MAX; remain = inhale + hold1 - t; }
    else if (t < inhale + hold1 + exhale) { ph = "exhale"; scale = lerp(MAX, MIN, (t - inhale - hold1) / exhale); remain = inhale + hold1 + exhale - t; }
    else { ph = "hold2"; scale = MIN; remain = cycleLen - t; }
    return { done, ph, scale, remain };
  };

  const paint = (clock) => {
    const { done, ph, scale, remain } = compute(clock);
    if (circleRef.current) circleRef.current.style.transform = `scale(${scale.toFixed(3)})`;
    if (glowRef.current) glowRef.current.style.opacity = String((0.25 + (scale - MIN) / (MAX - MIN) * 0.5).toFixed(3));
    if (ph !== lastPhase.current) { lastPhase.current = ph; setPhase(ph); }
    const c = Math.max(1, Math.ceil(remain));
    setCount((prev) => (prev !== c ? c : prev));
    if (done !== lastCycle.current) {
      lastCycle.current = done;
      setCycles(done);
      onCycle?.(done);
      if (targetCycles && done >= targetCycles && !finished.current) { finished.current = true; onFinish?.(); }
    }
  };

  useMedClock(running, paint);

  // Peinture initiale (état figé au montage / à la pause).
  useEffect(() => {
    paint(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipHold = hold1 === 0 && hold2 === 0;
  const label = t(`meditation.breath.${phase === "hold1" || phase === "hold2" ? "hold" : phase}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
      <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* halo */}
        <div ref={glowRef} style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${accent}88 0%, ${accent}00 70%)`, filter: "blur(6px)", transition: "opacity .2s linear", pointerEvents: "none" }} />
        {/* anneaux repères fixes */}
        <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: `1px solid ${accent}22` }} />
        <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", border: `1px dashed ${accent}22` }} />
        {/* cercle animé */}
        <div ref={circleRef} style={{ width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle at 50% 40%, ${accent}cc, ${accent}55 70%, ${accent}22)`, border: `2px solid ${accent}`, boxShadow: `0 0 32px ${accent}55, inset 0 0 40px ${accent}44`, willChange: "transform" }} />
        {/* texte central */}
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 0.5, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{label}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1.1, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{count}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
        {cycles}{targetCycles ? ` / ${targetCycles}` : ""} {t("meditation.breath.cycle", { count: targetCycles || cycles })}
        {skipHold ? "" : ` · ${t("meditation.breath.withHolds")}`}
      </div>
    </div>
  );
}
