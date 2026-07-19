import { C } from "../../../lib/tokens.js";

/* ════════════════════════════════════════════════════════════════
   Catalogue des séances de méditation / relaxation — CONFIG PURE (aucun texte).
   Tous les libellés vivent dans i18n (namespace `meditation.*`), résolus au
   rendu par les composants. Ajouter une séance = une entrée déclarative.
     - kind "breathing" : pattern {inhale,hold1,exhale,hold2} (s), cycles par défaut.
     - kind "steps"     : `steps` = clé du tableau i18n `meditation.steps.<clé>`
                          (chaque étape { label, text } + `sec` fourni ici).
     - kind "jacobson"  : JACOBSON_GROUPS + contractSec/releaseSec.
   ════════════════════════════════════════════════════════════════ */

// Groupes musculaires de Jacobson (ordre travaillé). label/hint via i18n
// (meditation.jacobson.groups.<key>). `zone` = zone surlignée sur la silhouette.
export const JACOBSON_GROUPS = [
  { key: "hands", zone: "arms" },
  { key: "shoulders", zone: "shoulders" },
  { key: "face", zone: "head" },
  { key: "back", zone: "back" },
  { key: "belly", zone: "belly" },
  { key: "legs", zone: "legs" },
  { key: "feet", zone: "feet" },
];

// Durées (s) des étapes, alignées index par index sur les tableaux i18n
// meditation.steps.<clé>. Séparées du texte pour ne dupliquer aucune chaîne.
export const STEP_SECONDS = {
  schultz: [30, 60, 60, 45, 45, 45, 45, 30],
  prematch: [30, 40, 40, 20],
  postmatch: [40, 50, 50, 30],
  sleep: [40, 60, 60, 40],
  stress: [30, 50, 50, 40],
};

export const MED_SESSIONS = [
  // ── Respiration ──
  { id: "coherence", kind: "breathing", group: "breathing", accent: C.teal, pattern: { inhale: 5, hold1: 0, exhale: 5, hold2: 0 }, cycles: 30, durationMin: 5 },
  { id: "breath478", kind: "breathing", group: "breathing", accent: C.teal, pattern: { inhale: 4, hold1: 7, exhale: 8, hold2: 0 }, cycles: 8, durationMin: 3 },
  { id: "square", kind: "breathing", group: "breathing", accent: C.teal, pattern: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }, cycles: 12, durationMin: 3 },
  // ── Relaxation profonde ──
  { id: "schultz", kind: "steps", group: "deep", accent: C.viol, steps: "schultz", durationMin: 6 },
  { id: "jacobson", kind: "jacobson", group: "deep", accent: C.viol, contractSec: 5, releaseSec: 15, durationMin: 5 },
  // ── Séances courtes ──
  { id: "prematch", kind: "steps", group: "short", accent: C.blue, steps: "prematch", durationMin: 2 },
  { id: "postmatch", kind: "steps", group: "short", accent: C.blue, steps: "postmatch", durationMin: 3 },
  { id: "sleep", kind: "steps", group: "short", accent: C.blue, steps: "sleep", durationMin: 3 },
  { id: "stress", kind: "steps", group: "short", accent: C.blue, steps: "stress", durationMin: 3 },
];

// Groupes d'affichage (label via i18n meditation.groups.<key>).
export const MED_GROUPS = [
  { key: "breathing", emoji: "🌬️" },
  { key: "deep", emoji: "🧘" },
  { key: "short", emoji: "⏱️" },
];

// Résout les étapes d'une séance « steps » : fusionne les textes i18n avec les
// durées locales → [{ label, text, seconds }].
export function resolveSteps(session, t) {
  const texts = t(`meditation.steps.${session.steps}`, { returnObjects: true });
  const secs = STEP_SECONDS[session.steps] || [];
  return (Array.isArray(texts) ? texts : []).map((s, i) => ({ label: s.label, text: s.text, seconds: secs[i] ?? 30 }));
}
