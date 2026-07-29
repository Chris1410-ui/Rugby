import { C } from "./tokens.js";

/* Nature d'une séance / programme / protocole — ORTHOGONALE au `code` rugby
   (RS/COD/CSB…). Vocabulaire CONTRÔLÉ : indispensable pour l'agrégation
   anti-surcharge (compter les séances « FORCE » d'un jour de façon fiable).
   Couleur pour pastilles ; libellé traduit via data.nature.* (natureLabel).
   Aucune formule compliance/points n'en dépend — champ purement descriptif. */

export const NATURES = [
  "force",
  "conditioning",
  "vitesse",
  "prevention",
  "recuperation",
  "technique",
  "mobilite",
  "autre",
];

export const NATURE_COLOR = {
  force: C.coral,
  conditioning: C.teal,
  vitesse: C.blue,
  prevention: C.amb,
  recuperation: C.green,
  technique: C.viol,
  mobilite: C.gray,
  autre: C.gray,
};

// Défaut dérivé du `code` rugby (séances antérieures sans nature explicite).
// RS→force, COD/CDD→vitesse, CSB/CASB→conditioning, AC→technique, BLI→prévention.
const CODE_NATURE = {
  RS: "force",
  COD: "vitesse",
  CDD: "vitesse",
  CSB: "conditioning",
  CASB: "conditioning",
  AC: "technique",
  BLI: "prevention",
};

export const natureFromCode = (code) => CODE_NATURE[code] || "autre";

// Nature effective : valeur stockée si présente, sinon dérivée du code (repli
// pour les séances libres / anciennes qui n'ont pas de nature explicite).
export const effectiveNature = (nature, code) => nature || natureFromCode(code);

export const natureColor = (key) => NATURE_COLOR[key] || C.gray;

// Libellé traduit ; repli sur la clé brute si non traduit (nature personnalisée).
export const natureLabel = (t, key) => t(`data.nature.${key}`, { defaultValue: key || "" });

/* Mots-clés (FR/EN/NL) qui signalent un contenu d'endurance/cardio dans un
   intitulé libre de séance. Sert à l'avertissement doux « nature incohérente »
   quand le staff tape « Cardio & course » mais laisse la nature sur « force ».
   Détection best-effort, jamais bloquante — PUR. */
const CONDITIONING_HINTS = [
  "cardio", "conditioning", "course", "courir", "run", "running", "footing",
  "endurance", "aerobie", "aerobic", "hiit", "fractionne", "intervalle", "interval",
  "velo", "bike", "wattbike", "rameur", "aviron", "rowing", "vma", "vo2",
];

// Normalisation identique à identity.searchNorm (minuscule, sans accents).
const norm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// L'intitulé évoque-t-il du cardio/endurance ? Détection par TOKENS (pas de
// sous-chaîne : « développé » ne doit pas matcher « velo »). Un token compte
// s'il commence par un mot-clé (couvre pluriels : « courses », « rameurs »). PUR.
export function labelSuggestsConditioning(label) {
  const tokens = norm(label).split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.some((tk) => CONDITIONING_HINTS.some((kw) => tk.startsWith(kw)));
}

// Incohérence douce : intitulé cardio mais nature « force ». PUR, best-effort.
export function natureLooksInconsistent(label, nature) {
  return nature === "force" && labelSuggestsConditioning(label);
}
