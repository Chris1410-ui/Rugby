import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMedClock } from "./medTimer.js";

/* Moteur générique de séance guidée par ÉTAPES minutées (training autogène de
   Schultz + séances courtes avant-match / après-match / sommeil / stress).
   Texte en fondu-enchaîné, minuteur circulaire par étape, points de progression.
   Fond qui « respire » doucement. Dérivé de l'horloge monotone. */
export default function GuidedSteps({ steps, running, onFinish, accent }) {
  const { t } = useTranslation();
  const bounds = useMemo(() => {
    let acc = 0;
    return steps.map((s) => { acc += s.seconds; return acc; });
  }, [steps]);
  const total = bounds.length ? bounds[bounds.length - 1] : 0;

  const ringRef = useRef(null);
  const finished = useRef(false);
  const [idx, setIdx] = useState(0);
  const [remain, setRemain] = useState(steps[0]?.seconds ?? 0);

  const R = 52, CIRC = 2 * Math.PI * R;

  const paint = (clock) => {
    if (clock >= total) {
      if (!finished.current) { finished.current = true; onFinish?.(); }
      if (ringRef.current) ringRef.current.style.strokeDashoffset = "0";
      return;
    }
    let i = 0;
    while (i < bounds.length - 1 && clock >= bounds[i]) i += 1;
    const start = i === 0 ? 0 : bounds[i - 1];
    const len = steps[i].seconds;
    const within = clock - start;
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(CIRC * (1 - within / len));
    setIdx((p) => (p !== i ? i : p));
    const c = Math.max(1, Math.ceil(len - within));
    setRemain((p) => (p !== c ? c : p));
  };

  useMedClock(running, paint);
  useEffect(() => {
    paint(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = steps[Math.min(idx, steps.length - 1)];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
      {/* minuteur + fond respirant */}
      <div style={{ position: "relative", width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", background: `radial-gradient(circle, ${accent}44, ${accent}00 70%)`, animation: "medBreathe 6s ease-in-out infinite" }} />
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle ref={ringRef} cx="65" cy="65" r={R} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 65 65)" />
          <text x="65" y="72" textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff">{remain}</text>
        </svg>
      </div>

      <div key={idx} style={{ textAlign: "center", marginTop: 12, animation: "medFade .6s ease", maxWidth: 320 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: accent, textTransform: "uppercase" }}>{step.label}</div>
        <div style={{ fontSize: 15.5, color: "rgba(255,255,255,0.92)", lineHeight: 1.55, marginTop: 8 }}>{step.text}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 280 }}>
        {steps.map((s, i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < idx ? accent : i === idx ? "#fff" : "rgba(255,255,255,0.15)", transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{t("meditation.player.step", { n: Math.min(idx + 1, steps.length), total: steps.length })}</div>

      <style>{`@keyframes medFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes medBreathe{0%,100%{transform:scale(0.85);opacity:.5}50%{transform:scale(1.05);opacity:.9}}`}</style>
    </div>
  );
}
