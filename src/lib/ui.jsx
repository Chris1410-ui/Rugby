/* Atomes UI portés du prototype (SVG maison, styles inline). */
import { useEffect, useState } from "react";
import { C, sc } from "./tokens.js";
import { acwrZ } from "./metrics.js";
import { Clock } from "./icons.jsx";

export const Section = ({ title, right, children, style }) => (
  <div style={sc({ marginBottom: 12, ...style })}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5 }}>{title}</div>
      {right}
    </div>
    {children}
  </div>
);

export const KPI = ({ label, value, sub, color }) => (
  <div style={sc({ padding: 12 })}>
    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || "#fff", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{sub}</div>}
  </div>
);

export const Tag = ({ c, children }) => (
  <span style={{ background: `${c}22`, color: c, padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, border: `1px solid ${c}44` }}>{children}</span>
);

export const Pill = ({ v }) => {
  const z = acwrZ(v);
  return <span style={{ background: z.c, color: "#fff", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{v.toFixed(2)}</span>;
};

export const Dot = ({ s }) => {
  const m = { done: { c: C.green, t: "✓" }, missed: { c: C.coral, t: "✗" }, pending: { c: "rgba(255,255,255,0.15)", t: "◦" } };
  const i = m[s] || m.pending;
  return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 11, background: i.c, alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{i.t}</span>;
};

export const Ring = ({ val, max, color, label, size = 64, sw = 5, suffix = "" }) => {
  const r = size / 2 - sw;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.min(val, max) / max);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset .6s" }} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" fill="#fff" fontSize={size * 0.26} fontWeight="800">{val}{suffix}</text>
      </svg>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  );
};

export const LineChart = ({ pts, color, target, height = 120 }) => {
  const w = 300, h = height, pad = 8;
  const max = Math.max(target || 0, ...pts) * 1.1 || 1;
  const X = (i) => pad + (i * (w - 2 * pad)) / (pts.length - 1 || 1);
  const Y = (v) => h - pad - (v / max) * (h - 2 * pad);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${X(i)} ${Y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {target && <line x1={pad} y1={Y(target)} x2={w - pad} y2={Y(target)} stroke={C.amb} strokeWidth="1.5" strokeDasharray="4 4" />}
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="3.5" fill={color} />)}
    </svg>
  );
};

export const RestTimer = ({ seconds, onDone, accent }) => {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) { clearInterval(t); onDone && onDone(); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 9, padding: "8px 12px", marginBottom: 10 }}>
      <Clock size={15} color={accent} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: 5, width: `${(left / seconds) * 100}%`, background: accent, borderRadius: 3, transition: "width 1s linear" }} />
        </div>
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: accent }}>{mm}:{ss}</span>
      <button onClick={() => onDone && onDone()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Passer</button>
    </div>
  );
};

/* Barre de navigation basse (mobile-first). Défilement horizontal au-delà de 5
   onglets pour rester lisible sur mobile. */
export const BottomNav = ({ items, active, onSelect, accent }) => {
  const scroll = items.length > 5;
  return (
    <nav style={{ position: "sticky", bottom: 0, zIndex: 20, background: `${C.navy}f5`, backdropFilter: "blur(10px)", borderTop: `1px solid ${C.border2}`, display: "flex", padding: "6px 4px 8px", overflowX: scroll ? "auto" : "visible" }}>
      {items.map(([key, label, Icon, badge]) => {
        const on = active === key;
        return (
          <button key={key} onClick={() => onSelect(key)} style={{ flex: scroll ? "0 0 auto" : 1, minWidth: scroll ? 62 : "auto", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 6px", color: on ? accent : "rgba(255,255,255,0.45)", position: "relative" }}>
            <Icon size={20} color={on ? accent : "rgba(255,255,255,0.45)"} />
            <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 600, whiteSpace: "nowrap" }}>{label}</span>
            {badge > 0 && <span style={{ position: "absolute", top: 2, right: "50%", marginRight: -18, background: C.coral, color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 8, padding: "0 4px", minWidth: 13, textAlign: "center" }}>{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
};
