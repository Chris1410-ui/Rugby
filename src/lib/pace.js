/* Résolution d'allure pour les blocs cardio — JUMEAU de oneRM.js (@% → kg),
   appliqué au conditioning (%VMA → allure cible). Pur & testable.

   RÈGLE IDENTIQUE au 1RM : un %VMA sans MAS connue → PAS de valeur inventée.
   On renvoie { needsMas:true } et l'UI affiche « renseigne ta MAS ».

   ⚠️ UNITÉS. La MAS a DEUX représentations dans l'app :
     • players.mas          → km/h   (vérité unique par joueur ; sync ×3,6)
     • test_results.mas     → m/s     (métrique Top 14 brute)
   Ce module raisonne en km/h (players.mas). Utiliser msToKmh() pour convertir
   une valeur brute de test avant de la passer ici. */

export const MS_TO_KMH = 3.6;

export const msToKmh = (ms) => (ms > 0 ? Number(ms) * MS_TO_KMH : null);
export const kmhToMs = (kmh) => (kmh > 0 ? Number(kmh) / MS_TO_KMH : null);

/* Vitesse cible (km/h) à un %VMA donné, depuis la MAS du joueur (km/h).
   Retourne null si le %VMA ou la MAS manque (jamais une valeur fausse). */
export function computeTargetSpeedKmh(pctVMA, masKmh) {
  const pct = Number(pctVMA);
  const mas = Number(masKmh);
  if (!(pct > 0) || !(mas > 0)) return null;
  return (mas * pct) / 100;
}

// Allure (secondes par km) depuis une vitesse en km/h. null si vitesse invalide.
export function paceSecPerKmFromKmh(speedKmh) {
  const v = Number(speedKmh);
  return v > 0 ? 3600 / v : null;
}

/* Allure cible depuis un %VMA + la MAS (km/h) du joueur.
   - %VMA absent/0        → { speedKmh:null, secPerKm:null, needsMas:false } (pas de cible demandée)
   - %VMA présent, MAS ⌀  → { speedKmh:null, secPerKm:null, needsMas:true }  (« renseigne ta MAS »)
   - les deux présents    → { speedKmh, secPerKm, needsMas:false } */
export function computeTargetPace(pctVMA, masKmh) {
  const pct = Number(pctVMA);
  if (!(pct > 0)) return { speedKmh: null, secPerKm: null, needsMas: false };
  const speedKmh = computeTargetSpeedKmh(pct, masKmh);
  if (speedKmh == null) return { speedKmh: null, secPerKm: null, needsMas: true };
  return { speedKmh, secPerKm: paceSecPerKmFromKmh(speedKmh), needsMas: false };
}

// Convenience : allure cible d'un bloc cardio (lit block.pctVMA).
export function paceTargetForBlock(block, masKmh) {
  return computeTargetPace(block?.pctVMA, masKmh);
}

// ── Allure/vitesse RÉALISÉES (depuis distance saisie + temps saisi) ──────────

// Vitesse réalisée (km/h) depuis distance (m) et durée (s). null si invalide.
export function speedKmhFromDistanceTime(distanceM, durationSec) {
  const d = Number(distanceM);
  const s = Number(durationSec);
  if (!(d > 0) || !(s > 0)) return null;
  return (d * MS_TO_KMH) / s; // (d/1000) / (s/3600)
}

// Allure réalisée (secondes par km) depuis distance (m) et durée (s).
export function paceSecPerKmFromDistanceTime(distanceM, durationSec) {
  const d = Number(distanceM);
  const s = Number(durationSec);
  if (!(d > 0) || !(s > 0)) return null;
  return (s * 1000) / d;
}

// ── Formatage ────────────────────────────────────────────────────────────────

// Allure « m:ss » par km (secondes arrondies). "" si null.
export function formatPace(secPerKm) {
  const s = Number(secPerKm);
  if (!(s > 0)) return "";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Vitesse « X.X km/h » (1 décimale). "" si null.
export function formatSpeed(speedKmh) {
  const v = Number(speedKmh);
  return v > 0 ? `${v.toFixed(1)} km/h` : "";
}
