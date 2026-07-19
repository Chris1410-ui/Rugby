import { useEffect, useRef, useState } from "react";
import { C } from "./tokens.js";

/* Pull-to-refresh (tirer vers le bas pour rafraîchir) — mobile / PWA.
   Comportement natif : au sommet du scroll, un geste vers le bas fait descendre
   un spinner sous le header avec résistance élastique ; au relâchement au-delà
   du seuil, `onRefresh` est appelé et le spinner tourne jusqu'à sa résolution.

   Sûreté :
   - ne s'active QUE si la fenêtre est en haut (scrollY ≤ 0) ;
   - ignore les gestes dans un conteneur défilable non-au-sommet et dans tout
     élément `position:fixed` (modals/overlays) → ne casse ni le scroll ni les
     modals ;
   - le décalage `transform` n'est appliqué QUE pendant le geste/refresh, jamais
     au repos → n'affecte pas le `position:fixed` des modals ouverts ensuite. */

const THRESHOLD = 70; // px (après résistance) pour déclencher
const MAX = 110;      // décalage visuel max
const RESIST = 0.5;   // résistance élastique

export default function PullToRefresh({ onRefresh, disabled = false, children }) {
  const rootRef = useRef(null);
  const startY = useRef(0);
  const engaged = useRef(false);
  const pull = useRef(0);
  const refreshingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const eligible = (target) => {
      if (disabled || refreshingRef.current || !atTop()) return false;
      let el = target;
      const root = rootRef.current;
      while (el && el !== root && el !== document.body) {
        const s = window.getComputedStyle(el);
        if (s.position === "fixed") return false; // modal / overlay
        const oy = s.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return true;
    };

    const onStart = (e) => {
      if (e.touches.length !== 1 || !eligible(e.target)) { engaged.current = false; return; }
      startY.current = e.touches[0].clientY;
      engaged.current = true;
      setSettling(false);
    };
    const onMove = (e) => {
      if (!engaged.current) return;
      if (!atTop()) { engaged.current = false; pull.current = 0; setOffset(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { pull.current = 0; setOffset(0); return; }
      const p = Math.min(MAX, dy * RESIST);
      pull.current = p;
      setOffset(p);
      if (p > 4 && e.cancelable) e.preventDefault(); // bloque l'overscroll natif seulement pendant le tirage
    };
    const onEnd = async () => {
      if (!engaged.current) return;
      engaged.current = false;
      setSettling(true);
      if (pull.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setOffset(THRESHOLD);
        const started = Date.now();
        try { await onRefresh?.(); } catch { /* noop */ }
        // durée minimale pour un retour visuel lisible
        const wait = 450 - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        refreshingRef.current = false;
        setRefreshing(false);
      }
      pull.current = 0;
      setOffset(0);
    };

    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd, { passive: true });
    node.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, onRefresh]);

  const visible = offset > 0 || refreshing;
  const ready = offset >= THRESHOLD;
  const angle = Math.min(300, (offset / THRESHOLD) * 270);
  const anim = engaged.current ? "none" : "transform .22s ease, opacity .22s ease";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        aria-hidden
        style={{
          position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center",
          pointerEvents: "none", zIndex: 4,
          transform: `translateY(${Math.max(-6, offset - 40)}px)`,
          opacity: visible ? 1 : 0, transition: anim,
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.panel, border: `1px solid ${C.border}`, boxShadow: "0 3px 10px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner spinning={refreshing} angle={angle} ready={ready} />
        </div>
      </div>
      <div style={{ transform: visible ? `translateY(${offset}px)` : "none", transition: settling && !engaged.current ? "transform .22s ease" : "none" }}>
        {children}
      </div>
    </div>
  );
}

/* Spinner SVG : arc tournant (pendant le refresh) ou flèche/arc suivant le geste. */
function Spinner({ spinning, angle, ready }) {
  const color = ready || spinning ? C.coral : "rgba(255,255,255,0.55)";
  return (
    <svg
      width="17" height="17" viewBox="0 0 24 24" fill="none"
      style={spinning
        ? { animation: "ptrspin 0.7s linear infinite" }
        : { transform: `rotate(${angle}deg)`, transition: "transform .05s linear" }}
    >
      <style>{"@keyframes ptrspin{to{transform:rotate(360deg)}}"}</style>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
