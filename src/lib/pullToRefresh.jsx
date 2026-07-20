import { useEffect, useRef, useState } from "react";
import { C } from "./tokens.js";

/* Pull-to-refresh (tirer vers le bas pour rafraîchir) — mobile / PWA.
   Au sommet du scroll, un geste vers le bas fait descendre un spinner (résistance
   élastique) ; au relâchement au-delà du seuil, `onRefresh` est appelé et le
   spinner tourne jusqu'à sa résolution.

   Robustesse :
   - listeners posés sur `window` (le document EST le conteneur défilant) → le
     geste est capté quel que soit l'élément sous le doigt ;
   - sommet détecté via plusieurs sources (scrollY / documentElement / body) ;
   - `overscroll-behavior-y: contain` neutralise le pull-to-refresh NATIF du
     navigateur (Chrome Android) qui, sinon, capte le geste ou recharge la page ;
   - ne s'engage que si on est en haut, hors modal (`position:fixed`) et hors
     conteneur défilable non-au-sommet → ne casse ni le scroll ni les modals ;
   - `preventDefault` uniquement pendant le tirage réel (sinon scroll normal). */

const THRESHOLD = 64; // px (après résistance) pour déclencher
const MAX = 96;       // décalage visuel max
const RESIST = 0.5;   // résistance élastique

export default function PullToRefresh({ onRefresh, disabled = false, children }) {
  const onRefreshRef = useRef(onRefresh); onRefreshRef.current = onRefresh;
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const startY = useRef(0);
  const engaged = useRef(false);
  const pull = useRef(0);
  const refreshingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const scrollTop = () =>
      window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    // Vrai si le geste part d'un overlay fixed (modal) ou d'un scroller pas au sommet.
    const blocked = (target) => {
      let el = target;
      while (el && el.nodeType === 1 && el !== document.body) {
        const s = window.getComputedStyle(el);
        if (s.position === "fixed") return true;
        const oy = s.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return true;
        el = el.parentElement;
      }
      return false;
    };

    const onStart = (e) => {
      engaged.current = false;
      if (disabledRef.current || refreshingRef.current || e.touches.length !== 1) return;
      if (scrollTop() > 0 || blocked(e.target)) return;
      startY.current = e.touches[0].clientY;
      engaged.current = true;
    };
    const onMove = (e) => {
      if (!engaged.current) return;
      if (scrollTop() > 0) { engaged.current = false; pull.current = 0; setOffset(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { pull.current = 0; setOffset(0); return; }
      const p = Math.min(MAX, dy * RESIST);
      pull.current = p;
      setOffset(p);
      if (e.cancelable) e.preventDefault(); // bloque l'overscroll natif pendant le tirage
    };
    const onEnd = async () => {
      if (!engaged.current) return;
      engaged.current = false;
      if (pull.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setOffset(THRESHOLD);
        const t0 = Date.now();
        try { await onRefreshRef.current?.(); } catch { /* noop */ }
        const wait = 550 - (Date.now() - t0); // durée mini pour un retour visuel lisible
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        refreshingRef.current = false;
        setRefreshing(false);
      }
      pull.current = 0;
      setOffset(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []); // stable : onRefresh / disabled lus via refs

  // Neutralise le pull-to-refresh natif du navigateur pendant le montage.
  useEffect(() => {
    const el = document.documentElement;
    const prevBody = document.body.style.overscrollBehaviorY;
    const prevHtml = el.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "contain";
    el.style.overscrollBehaviorY = "contain";
    return () => { document.body.style.overscrollBehaviorY = prevBody; el.style.overscrollBehaviorY = prevHtml; };
  }, []);

  const visible = offset > 0 || refreshing;
  const ready = offset >= THRESHOLD;
  const angle = Math.min(300, (offset / THRESHOLD) * 270);
  const idle = !engaged.current;

  return (
    <div style={{ position: "relative" }}>
      {/* Spinner FIXE, centré, glissant sous le header. z-index < modals (300+),
          > contenu. Émerge de sous le header à mesure du tirage. */}
      <div
        aria-hidden
        style={{
          position: "fixed", top: 4, left: 0, right: 0, display: "flex", justifyContent: "center",
          pointerEvents: "none", zIndex: 26,
          transform: `translateY(${Math.max(0, offset)}px)`,
          opacity: visible ? 1 : 0,
          transition: idle ? "opacity .2s ease, transform .22s ease" : "none",
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.panel, border: `1px solid ${C.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner spinning={refreshing} angle={angle} ready={ready} />
        </div>
      </div>
      <div style={{ transform: visible ? `translateY(${offset}px)` : "none", transition: idle ? "transform .22s ease" : "none", willChange: visible ? "transform" : "auto" }}>
        {children}
      </div>
    </div>
  );
}

/* Spinner SVG : arc tournant (refresh) ou arc orienté suivant le geste. */
function Spinner({ spinning, angle, ready }) {
  const color = ready || spinning ? C.coral : "rgba(255,255,255,0.6)";
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      style={spinning ? { animation: "ptrspin 0.7s linear infinite" } : { transform: `rotate(${angle}deg)`, transition: "transform .05s linear" }}
    >
      <style>{/* i18n-ok: CSS keyframes */}{"@keyframes ptrspin{to{transform:rotate(360deg)}}"}</style>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
