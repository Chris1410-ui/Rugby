import { useEffect, useRef } from "react";

/* Horloge monotone pausable pour les séances (respiration, étapes, Jacobson).
   Avance UNIQUEMENT tant que `running` est vrai. À chaque frame (rAF), appelle
   `onFrame(elapsedSec)` avec le temps écoulé cumulé — les visualisations
   écrivent directement dans des refs (transform, rayon…) pour rester fluides
   sans re-render React à 60 fps. Mettre `running` à false fige l'horloge ;
   `reset()` la remet à zéro. `onFrame` est capté par ref → pas de redémarrage
   du rAF à chaque render. */
export function useMedClock(running, onFrame) {
  const cb = useRef(onFrame);
  cb.current = onFrame;
  const state = useRef({ raf: 0, last: 0, acc: 0 });

  useEffect(() => {
    if (!running) return undefined;
    const s = state.current;
    s.last = performance.now();
    const loop = (now) => {
      const dt = (now - s.last) / 1000;
      s.last = now;
      s.acc += dt;
      cb.current?.(s.acc, dt);
      s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(s.raf);
  }, [running]);

  return {
    getElapsed: () => state.current.acc,
    reset: () => { state.current.acc = 0; },
  };
}

// Empêche l'écran de s'éteindre pendant une séance (si l'API est dispo).
// No-op silencieux sinon (navigateurs sans Wake Lock).
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return undefined;
    let sentinel = null;
    let released = false;
    navigator.wakeLock.request("screen").then((s) => { if (released) s.release?.(); else sentinel = s; }).catch(() => {});
    return () => { released = true; try { sentinel?.release?.(); } catch { /* noop */ } };
  }, [active]);
}

/* Vibration haptique (feedback des séances). navigator.vibrate n'existe pas sur
   iOS/Safari → no-op silencieux (le visuel/audio suffisent). `pattern` = nombre
   (ms) ou tableau [vibre, pause, vibre…]. vibe(0) coupe toute vibration en cours. */
export function vibe(pattern) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch { /* certains navigateurs lèvent hors interaction utilisateur → ignoré */ }
}

// mm:ss depuis des secondes.
export const fmtClock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
