/* Atomes UI portés du prototype (SVG maison, styles inline). */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "./tokens.js";
import { acwrZ } from "./metrics.js";
import { Clock, Grid, X } from "./icons.jsx";
import i18n from "../i18n/config.js";

// Traduction hors composant (atomes sans hook, ex. aria-label de CloseX).
const tt = (key) => i18n.t(key);

/* ── Fermeture des modaux / bottom sheets (comportement global cohérent) ──
   - CloseX : bouton croix avec cible tactile ≥ 44×44 px (padding cliquable
     autour du glyphe), z-index propre → jamais recouvert par le contenu.
   - useModalClose : ferme au bouton/gesture RETOUR (history) et à Échap.
   - useSwipeDown : poignée de bottom sheet → glisser vers le bas pour fermer.
   - Backdrop : clic/tap sur le fond sombre ferme (via <Overlay/>). */
export const CloseX = ({ onClose, style }) => (
  <button
    type="button"
    aria-label={tt("common.close")}
    onClick={(e) => { e.stopPropagation(); onClose(); }}
    style={{ position: "relative", zIndex: 2, width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 12, color: "rgba(255,255,255,0.85)", cursor: "pointer", WebkitTapHighlightColor: "transparent", ...style }}
  >
    <X size={20} />
  </button>
);

export function useModalClose(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!ref.current) return undefined; // rendu inline (pas de modal) → no-op
    const onKey = (e) => { if (e.key === "Escape") ref.current?.(); };
    let viaPop = false;
    try { window.history.pushState({ modal: true }, ""); } catch { /* noop */ }
    const onPop = () => { viaPop = true; ref.current?.(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      if (!viaPop) { try { window.history.back(); } catch { /* noop */ } }
    };
  }, []);
}

export function useSwipeDown(onClose, threshold = 60) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => { start.current = e.touches[0]?.clientY ?? null; },
    onTouchEnd: (e) => {
      if (start.current == null) return;
      const dy = (e.changedTouches[0]?.clientY ?? start.current) - start.current;
      start.current = null;
      if (dy > threshold) onClose();
    },
  };
}

// Poignée visuelle d'un bottom sheet (zone de swipe).
export const SheetHandle = ({ onClose }) => {
  const sw = useSwipeDown(onClose);
  return (
    <div {...sw} style={{ display: "flex", justifyContent: "center", padding: "6px 0 10px", cursor: "grab", touchAction: "none" }}>
      <div style={{ width: 40, height: 4, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
    </div>
  );
};

/* Overlay standard : fond sombre (tap = fermeture) + conteneur centré ou bottom
   sheet. Gère RETOUR/Échap. `sheet` → feuille du bas avec poignée + swipe. */
export const Overlay = ({ onClose, children, sheet = false, maxWidth = 760, z = 300, contentStyle }) => {
  useModalClose(onClose);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: z, display: "flex", alignItems: sheet ? "flex-end" : "center", justifyContent: "center", padding: sheet ? 0 : "16px 12px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: sheet ? "100%" : maxWidth, background: C.navy, borderRadius: sheet ? "18px 18px 0 0" : 18, maxHeight: sheet ? "85vh" : "90vh", overflowY: "auto", ...contentStyle }}
      >
        {sheet && <SheetHandle onClose={onClose} />}
        {children}
      </div>
    </div>
  );
};

export const Section = ({ title, right, children, style }) => (
  <div style={sc({ marginBottom: 12, ...style })}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5 }}>{title}</div>
      {right}
    </div>
    {children}
  </div>
);

export const KPI = ({ label, value, sub, color }) => (
  <div style={sc({ padding: 12 })}>
    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || "#fff", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.56)", marginTop: 4 }}>{sub}</div>}
  </div>
);

export const Tag = ({ c, children, title }) => (
  <span title={title} style={{ background: `${c}22`, color: c, padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, border: `1px solid ${c}44` }}>{children}</span>
);

export const Pill = ({ v }) => {
  const z = acwrZ(v);
  return <span style={{ background: z.c, color: "#fff", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{v.toFixed(2)}</span>;
};

export const Dot = ({ s }) => {
  const m = { done: { c: C.green, t: "✓" }, missed: { c: C.coral, t: "✗" }, postponed: { c: C.gray, t: "⤴" }, pending: { c: "rgba(255,255,255,0.15)", t: "◦" } };
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
  const { t } = useTranslation();
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
      <button onClick={() => onDone && onDone()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{t("common.skip")}</button>
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
          <button key={key} onClick={() => onSelect(key)} style={{ flex: scroll ? "0 0 auto" : 1, minWidth: scroll ? 62 : "auto", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 6px", color: on ? accent : "rgba(255,255,255,0.62)", position: "relative" }}>
            <Icon size={20} color={on ? accent : "rgba(255,255,255,0.62)"} />
            <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 600, whiteSpace: "nowrap" }}>{label}</span>
            {badge > 0 && <span style={{ position: "absolute", top: 2, right: "50%", marginRight: -18, background: C.coral, color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 8, padding: "0 4px", minWidth: 13, textAlign: "center" }}>{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
};

const navBtn = (on, accent) => ({ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 4px", color: on ? accent : "rgba(255,255,255,0.62)", position: "relative" });
const dot = (v) => (v > 0 ? <span style={{ position: "absolute", top: 2, right: "50%", marginRight: -16, background: C.coral, color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 8, padding: "0 4px", minWidth: 13, textAlign: "center" }}>{v > 9 ? "9+" : v}</span> : null);

/* Navigation mobile : barre du bas fixe de N onglets « principaux » + bouton
   « Plus » ouvrant un hub en grille listant TOUTES les sections (icône + label
   + pastille de non-lus). `items` = liste complète [key,label,Icon,badge] ;
   `primary` = clés affichées dans la barre. */
export const MobileNav = ({ items, primary, active, onSelect, accent }) => {
  const { t } = useTranslation();
  const [hub, setHub] = useState(false);
  const byKey = Object.fromEntries(items.map((it) => [it[0], it]));
  const primItems = primary.map((k) => byKey[k]).filter(Boolean);
  const primSet = new Set(primary);
  const hiddenBadge = items.reduce((a, it) => a + (primSet.has(it[0]) ? 0 : (it[3] || 0)), 0);
  const activeHidden = !primSet.has(active);

  return (
    <>
      <nav style={{ position: "sticky", bottom: 0, zIndex: 20, background: `${C.navy}f5`, backdropFilter: "blur(10px)", borderTop: `1px solid ${C.border2}`, display: "flex", padding: "6px 4px 8px" }}>
        {primItems.map(([key, label, Icon, badge]) => {
          const on = active === key;
          return (
            <button key={key} onClick={() => onSelect(key)} style={navBtn(on, accent)}>
              <Icon size={21} color={on ? accent : "rgba(255,255,255,0.62)"} />
              <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
              {dot(badge)}
            </button>
          );
        })}
        <button onClick={() => setHub(true)} style={navBtn(hub || activeHidden, accent)}>
          <Grid size={21} color={hub || activeHidden ? accent : "rgba(255,255,255,0.62)"} />
          <span style={{ fontSize: 9.5, fontWeight: hub || activeHidden ? 800 : 600 }}>{t("common.more")}</span>
          {dot(hiddenBadge)}
        </button>
      </nav>
      {hub && <NavHub items={items} active={active} accent={accent} onSelect={(k) => { onSelect(k); setHub(false); }} onClose={() => setHub(false)} />}
    </>
  );
};

/* Hub en grille (feuille du bas) : toutes les sections en tuiles. */
export const NavHub = ({ items, active, accent, onSelect, onClose }) => {
  const { t } = useTranslation();
  useModalClose(onClose);
  return (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: C.navy, borderTop: `1px solid ${C.border2}`, borderRadius: "18px 18px 0 0", padding: "4px 14px 22px", maxHeight: "80vh", overflowY: "auto" }}>
      <SheetHandle onClose={onClose} />
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{t("common.menu")}</div>
        <CloseX onClose={onClose} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {items.map(([key, label, Icon, badge]) => {
          const on = active === key;
          return (
            <button key={key} onClick={() => onSelect(key)} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, padding: "16px 6px", borderRadius: 14, cursor: "pointer", background: on ? `${accent}22` : "rgba(255,255,255,0.05)", border: `1px solid ${on ? accent : C.border}`, color: "#fff" }}>
              <Icon size={22} color={on ? accent : "rgba(255,255,255,0.8)"} />
              <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
              {badge > 0 && <span style={{ position: "absolute", top: 7, right: 7, background: C.coral, color: "#fff", fontSize: 8.5, fontWeight: 800, borderRadius: 8, padding: "0 4px", minWidth: 14, textAlign: "center" }}>{badge > 9 ? "9+" : badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  </div>
  );
};
