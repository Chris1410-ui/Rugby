/* Standards du rapport de performance, PAR POSTE. Les valeurs ne sont JAMAIS en
   dur ici : elles délèguent au référentiel Top 14 existant (lib/top14.js,
   TOP14_BENCH — éditable). Ce module n'ajoute que la présentation propre au
   rapport : libellés, unités, groupe (terrain / force / cardio), et formatage. */

import { TOP14_BENCH, posToCat } from "../top14.core.js";

// Ordre + métadonnées d'affichage des 9 tests du référentiel.
// group: field (terrain) | strength (×PC) | cardio ; dir: up = plus haut mieux,
// down = plus bas mieux (Bronco). perBw: cible exprimée en × poids de corps.
export const REPORT_TESTS = [
  { key: "bronco",    label: "Test d'endurance Bronco", group: "field",    dir: "down", perBw: false },
  { key: "cmj",       label: "CMJ (saut vertical)",     group: "field",    dir: "up",   perBw: false, unit: "cm" },
  { key: "squat",     label: "Force max squat (5RM)",   group: "strength", dir: "up",   perBw: true },
  { key: "bench",     label: "Développé couché (5RM)",  group: "strength", dir: "up",   perBw: true },
  { key: "deadlift",  label: "Soulevé de terre",        group: "strength", dir: "up",   perBw: true },
  { key: "hangclean", label: "Hang Clean (2RM)",        group: "strength", dir: "up",   perBw: true },
  { key: "tractions", label: "Tractions lestées (1RM)", group: "strength", dir: "up",   perBw: true, plus: true },
  { key: "mas",       label: "Vitesse Maximale Aérobie (VMA)", group: "cardio", dir: "up", unit: "m/s" },
  { key: "yoyo",      label: "Test navette Yo-Yo IR1",  group: "cardio",   dir: "up",   unit: "m" },
];
export const REPORT_TEST_BY_KEY = Object.fromEntries(REPORT_TESTS.map((t) => [t.key, t]));

// Seuil Top 14 (borne basse) d'un test pour un poste, ou null si poste inconnu.
export function thresholdFor(pos, key) {
  const cat = posToCat(pos);
  return cat ? (TOP14_BENCH[cat]?.[key] ?? null) : null;
}

// Cible en kg d'un test de force (× PC), recalculée au poids réel. null sinon.
export function strengthTargetKg(pos, key, weightKg) {
  const meta = REPORT_TEST_BY_KEY[key];
  const thr = thresholdFor(pos, key);
  if (!meta?.perBw || thr == null || !(weightKg > 0)) return null;
  return thr * weightKg;
}

/* ── Formatage (français) ── */
export const frNum = (n, d = 1) => (n == null || !Number.isFinite(n) ? "—" : Number(n).toFixed(d).replace(".", ",").replace(/,0$/, ""));
export const secToMMSS = (s) => {
  if (s == null || !Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return `${m}'${String(sec).padStart(2, "0")}`;
};
export const roundKg = (k) => (k == null ? "—" : Math.round(k));

// Échappe le texte libre (nom, historique blessures) avant insertion HTML : le
// rapport est rendu par un navigateur headless → on neutralise toute injection.
export const escapeHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
