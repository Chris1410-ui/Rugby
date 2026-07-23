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
