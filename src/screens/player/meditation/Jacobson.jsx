import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { useMedClock } from "./medTimer.js";

/* Relaxation musculaire progressive de Jacobson : pour chaque groupe musculaire,
   on CONTRACTE (~5 s) puis on RELÂCHE (~15 s), l'un après l'autre. Une silhouette
   SVG surligne la zone travaillée : rouge/ambré + pulsation quand on contracte,
   bleu/teal apaisé quand on relâche. Minuteur circulaire de la phase + consignes
   défilantes. Tout est dérivé de l'horloge monotone → pause/reprise propres. */
const CONTRACT_COL = C.amb, RELEASE_COL = C.teal;

// Silhouette simple ; chaque partie s'allume selon la zone active et la phase.
function Body({ zone, phase }) {
  const on = (z) => z === zone;
  const col = phase === "contract" ? CONTRACT_COL : RELEASE_COL;
  const fill = (z) => (on(z) ? col : "rgba(255,255,255,0.10)");
  const stroke = (z) => (on(z) ? col : "rgba(255,255,255,0.18)");
  const glow = (z) => (on(z) ? `drop-shadow(0 0 6px ${col})` : "none");
  const P = (z, el) => ({ fill: fill(z), stroke: stroke(z), strokeWidth: 1.5, style: { filter: glow(z), transition: "fill .35s, filter .35s" }, ...el });
  return (
    <svg width="150" height="240" viewBox="0 0 150 240" style={{ maxWidth: "60%" }}>
      {/* tête (visage) */}
      <circle cx="75" cy="26" r="18" {...P("head")} />
      {/* épaules & nuque */}
      <rect x="48" y="44" width="54" height="16" rx="8" {...P("shoulders")} />
      {/* bras/avant-bras + mains (gauche/droite) */}
      <rect x="30" y="60" width="14" height="70" rx="7" {...P("arms")} />
      <rect x="106" y="60" width="14" height="70" rx="7" {...P("arms")} />
      {/* dos / haut du torse */}
      <rect x="50" y="60" width="50" height="42" rx="12" {...P("back")} />
      {/* ventre / bas du torse */}
      <rect x="52" y="100" width="46" height="40" rx="12" {...P("belly")} />
      {/* jambes */}
      <rect x="54" y="142" width="18" height="70" rx="9" {...P("legs")} />
      <rect x="78" y="142" width="18" height="70" rx="9" {...P("legs")} />
      {/* pieds */}
      <rect x="50" y="212" width="24" height="14" rx="6" {...P("feet")} />
      <rect x="76" y="212" width="24" height="14" rx="6" {...P("feet")} />
    </svg>
  );
}

export default function Jacobson({ groups, contractSec, releaseSec, running, onFinish, accent }) {
  const { t } = useTranslation();
  const G = contractSec + releaseSec;
  const total = groups.length * G;
  const ringRef = useRef(null);
  const finished = useRef(false);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("contract");
  const [remain, setRemain] = useState(contractSec);

  const R = 46, CIRC = 2 * Math.PI * R;

  const paint = (clock) => {
    if (clock >= total) {
      if (!finished.current) { finished.current = true; onFinish?.(); }
      if (ringRef.current) ringRef.current.style.strokeDashoffset = "0";
      return;
    }
    const gi = Math.floor(clock / G);
    const within = clock - gi * G;
    const ph = within < contractSec ? "contract" : "release";
    const rem = ph === "contract" ? contractSec - within : G - within;
    const phaseLen = ph === "contract" ? contractSec : releaseSec;
    const phaseElapsed = ph === "contract" ? within : within - contractSec;
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(CIRC * (1 - phaseElapsed / phaseLen));
    setIdx((p) => (p !== gi ? gi : p));
    setPhase((p) => (p !== ph ? ph : p));
    const c = Math.max(1, Math.ceil(rem));
    setRemain((p) => (p !== c ? c : p));
  };

  useMedClock(running, paint);
  useEffect(() => {
    paint(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = groups[Math.min(idx, groups.length - 1)];
  const contracting = phase === "contract";
  const col = contracting ? CONTRACT_COL : RELEASE_COL;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Body zone={g.zone} phase={phase} />
        {/* minuteur circulaire de la phase */}
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle ref={ringRef} cx="60" cy="60" r={R} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 60 60)" style={{ transition: "stroke .35s" }} />
          <text x="60" y="54" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff">{remain}</text>
          <text x="60" y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill={col}>{contracting ? t("meditation.jacobson.contract") : t("meditation.jacobson.release")}</text>
        </svg>
      </div>

      <div style={{ marginTop: 8, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{t(`meditation.jacobson.groups.${g.key}.label`)}</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 3, minHeight: 34, maxWidth: 300 }}>
          {contracting ? t(`meditation.jacobson.groups.${g.key}.hint`) : t("meditation.jacobson.releaseHint")}
        </div>
      </div>

      {/* progression des groupes */}
      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 280 }}>
        {groups.map((gr, i) => (
          <span key={gr.key} style={{ width: 9, height: 9, borderRadius: 5, background: i < idx ? accent : i === idx ? col : "rgba(255,255,255,0.15)", transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{t("meditation.jacobson.group", { n: Math.min(idx + 1, groups.length), total: groups.length })}</div>
    </div>
  );
}
