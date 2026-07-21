import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { useMedClock, vibe } from "./medTimer.js";
import { contractionPhases } from "./sessions.js";

/* « Jacobson modifié » (contraction globale). Déroule, par répétition :
   3 cycles inspiration/expiration (cercle qui grandit/rétrécit + pulsation
   haptique), une 4ᵉ inspiration, puis BLOCAGE + CONTRACTION de tous les muscles
   (10 s, compte à rebours 10→0, buzz intense qui s'intensifie sur les 5 dernières
   secondes), enfin RELÂCHEMENT total (longue expiration ~15 s, retour au calme).
   Piloté par l'horloge monotone → pause/reprise sans à-coup. Consignes i18n. */
const MIN = 0.5, MAX = 1;
const lerp = (a, b, t) => a + (b - a) * t;

// Couleur par phase : respiration = accent, contraction = rouge, relâchement = teal.
const colorFor = (ty, accent) => (ty === "contract" ? C.coral : ty === "release" ? C.teal : accent);

/* Motif de vibration couvrant TOUTE la contraction (~sec s, une paire ≈ 1 s) :
   quasi-continu, puis plus intense (buzz plus long) sur la 2ᵉ moitié — les
   5 dernières secondes. vibe(0) le coupe à la libération. */
function contractPattern(sec) {
  const half = Math.floor(sec / 2), pat = [];
  for (let i = 0; i < half; i++) pat.push(820, 180);      // 1re moitié : ~1 s/paire
  for (let i = 0; i < sec - half; i++) pat.push(940, 60); // 2ᵉ moitié : intensifié
  return pat;
}

export default function ContractionCycle({ session, reps, running, onFinish, accent }) {
  const { t } = useTranslation();
  const base = useMemo(() => contractionPhases(session), [session]);
  // Timeline complète = reps × phases, avec bornes temporelles cumulées.
  const timeline = useMemo(() => {
    const items = []; let acc = 0;
    for (let r = 0; r < reps; r++) for (const ph of base) { items.push({ ...ph, start: acc, end: acc + ph.sec, rep: r }); acc += ph.sec; }
    return { items, total: acc };
  }, [base, reps]);

  const circleRef = useRef(null), glowRef = useRef(null);
  const lastKey = useRef(null);
  const finished = useRef(false);
  const [type, setType] = useState(base[0]?.type || "inhale");
  const [rep, setRep] = useState(0);
  const [count, setCount] = useState(Math.ceil(base[0]?.sec || 5));

  const paint = (clock) => {
    if (clock >= timeline.total) {
      if (!finished.current) { finished.current = true; vibe(0); onFinish?.(); }
      if (circleRef.current) circleRef.current.style.transform = `scale(${MIN})`;
      return;
    }
    const cur = timeline.items.find((it) => clock < it.end) || timeline.items[timeline.items.length - 1];
    const within = clock - cur.start;
    const frac = Math.min(1, within / cur.sec);

    let scale;
    if (cur.type === "inhale" || cur.type === "inhale4") scale = lerp(MIN, MAX, frac);
    else if (cur.type === "exhale") scale = lerp(MAX, MIN, frac);
    else if (cur.type === "contract") scale = MAX - 0.025 + 0.025 * Math.abs(Math.sin(within * Math.PI * 3)); // throb serré
    else scale = lerp(MAX, MIN, frac); // release : longue décrue

    const col = colorFor(cur.type, accent);
    if (circleRef.current) {
      const c = circleRef.current;
      c.style.transform = `scale(${scale.toFixed(3)})`;
      c.style.background = `radial-gradient(circle at 50% 40%, ${col}cc, ${col}55 70%, ${col}22)`;
      c.style.borderColor = col;
      c.style.boxShadow = `0 0 32px ${col}55, inset 0 0 40px ${col}44`;
    }
    if (glowRef.current) {
      // Halo : pulsation forte pendant la contraction (intensifiée sur la fin).
      let o = 0.25 + (scale - MIN) / (MAX - MIN) * 0.5;
      if (cur.type === "contract") { const ramp = frac > 0.5 ? 1 : 0.6; o = 0.55 + 0.4 * Math.abs(Math.sin(within * Math.PI * 4)) * ramp; }
      glowRef.current.style.opacity = String(o.toFixed(3));
      glowRef.current.style.background = `radial-gradient(circle, ${col}88 0%, ${col}00 70%)`;
    }

    // Transition de phase → état + vibration.
    const key = `${cur.rep}:${cur.type}:${cur.start}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      setType((p) => (p !== cur.type ? cur.type : p));
      setRep((p) => (p !== cur.rep ? cur.rep : p));
      if (cur.type === "inhale" || cur.type === "inhale4") vibe(60);
      else if (cur.type === "exhale") vibe(40);
      else if (cur.type === "contract") vibe(contractPattern(cur.sec));
      else if (cur.type === "release") vibe(0);
    }
    const rem = Math.max(1, Math.ceil(cur.sec - within));
    setCount((p) => (p !== rem ? rem : p));
  };

  useMedClock(running, paint);
  useEffect(() => {
    paint(0); // peinture initiale (montage / pause)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // À la pause / au démontage : couper toute vibration en cours.
  useEffect(() => { if (!running) vibe(0); return () => vibe(0); }, [running]);

  const col = colorFor(type, accent);
  const contracting = type === "contract";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
      <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div ref={glowRef} style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${accent}88 0%, ${accent}00 70%)`, filter: "blur(6px)", transition: "opacity .12s linear", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: `1px solid ${accent}22` }} />
        <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", border: `1px dashed ${accent}22` }} />
        <div ref={circleRef} style={{ width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle at 50% 40%, ${accent}cc, ${accent}55 70%, ${accent}22)`, border: `2px solid ${accent}`, boxShadow: `0 0 32px ${accent}55, inset 0 0 40px ${accent}44`, willChange: "transform" }} />
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 0.5, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{t(`meditation.contraction.label.${type}`)}</div>
          <div style={{ fontSize: contracting ? 52 : 40, fontWeight: 900, color: "#fff", lineHeight: 1.05, textShadow: "0 1px 8px rgba(0,0,0,0.5)", transition: "font-size .2s" }}>{count}</div>
        </div>
      </div>

      {/* Consigne défilante synchronisée */}
      <div key={type} style={{ marginTop: 12, textAlign: "center", minHeight: 40, maxWidth: 320, fontSize: 13.5, fontWeight: 600, color: contracting ? C.coral : "rgba(255,255,255,0.75)", lineHeight: 1.5, animation: "medFade .4s ease" }}>
        {t(`meditation.contraction.hint.${type}`)}
      </div>

      {/* Progression des répétitions */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 240 }}>
        {Array.from({ length: reps }).map((_, i) => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: 5, background: i < rep ? accent : i === rep ? col : "rgba(255,255,255,0.15)", transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{t("meditation.contraction.rep", { n: Math.min(rep + 1, reps), total: reps })}</div>
    </div>
  );
}
