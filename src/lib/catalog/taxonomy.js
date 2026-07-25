/* Extraction de la TAXONOMIE (facettes fixes) d'une section détectée :
   objectif (vocabulaire nature), matériel, durée indicative. Postes / période /
   catégorie d'âge sont laissés vides en MVP (complétés par l'owner au versement).
   Pur et déterministe. `exerciseIndex` = Map(slug(nom) → { ref, equipment }) issu
   de la bibliothèque, optionnel — quand fourni, matériel + liens en sont enrichis. */
import { norm } from "./detect.js";
import { slug } from "./fingerprint.js";

// Type fonctionnel → objectif (vocabulaire nature contrôlé, cf. lib/nature.js).
const KIND_TO_OBJECTIVE = {
  warmup: "mobilite", mobility: "mobilite", recovery: "recuperation",
  prevention: "prevention", cardio: "conditioning", strength: "force",
  superset: "force", checklist: "autre", planning: "autre",
  table: "autre", note: "technique", other: "autre",
};

// Matériel reconnu par mots-clés (normalisés) → étiquette canonique.
const EQUIPMENT_KEYWORDS = {
  halteres: ["haltere", "dumbbell"],
  barre: ["barre", "barbell"],
  elastique: ["elastique", "band"],
  kettlebell: ["kettlebell", "kb"],
  machine: ["machine", "poulie", "presse"],
  medecine_ball: ["medecine ball", "med ball", "wall ball"],
  rameur: ["rameur", "rower"],
  velo: ["velo", "assault bike", "airbike"],
  foam_roller: ["foam", "rouleau"],
  plots: ["plot", "cone", "cerceau"],
};

export function objectiveOfKind(kind) {
  return KIND_TO_OBJECTIVE[kind] || "autre";
}

// Détecte le matériel : mots-clés du texte + équipement des exercices liés.
export function detectEquipment(section, exerciseIndex) {
  const s = section || {};
  const parts = [];
  if (Array.isArray(s.rows)) s.rows.forEach((r) => parts.push(r?.name, r?.note));
  if (Array.isArray(s.items)) s.items.forEach((it) => parts.push(typeof it === "string" ? it : `${it?.name} ${it?.note}`));
  parts.push(s.body);
  const text = norm(parts.filter(Boolean).join(" "));

  const found = new Set();
  for (const [label, kws] of Object.entries(EQUIPMENT_KEYWORDS)) {
    if (kws.some((kw) => text.includes(kw))) found.add(label);
  }
  // Enrichissement via la bibliothèque (équipement fiché de chaque exercice lié).
  if (exerciseIndex && Array.isArray(s.rows)) {
    for (const r of s.rows) {
      const hit = exerciseIndex.get(slug(r?.name));
      const eq = norm(hit?.equipment);
      if (eq && eq !== "body weight" && eq !== "poids du corps") found.add(eq.replace(/\s+/g, "_"));
      if (norm(hit?.equipment) === "body weight" || norm(hit?.equipment) === "poids du corps") found.add("aucun");
    }
  }
  return [...found].sort();
}

/* Extrait la taxonomie d'une section. Retourne des facettes fixes ; les champs
   non déductibles automatiquement restent vides (positions/period/age). */
export function extractTaxonomy(section, kind, { exerciseIndex } = {}) {
  return {
    objective: objectiveOfKind(kind),
    equipment: detectEquipment(section, exerciseIndex),
    duration_min: null,   // renseigné par l'owner au versement (MVP)
    positions: [],
    period: null,
    age_category: null,
  };
}
