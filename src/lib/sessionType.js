/* Type de séance = MODÈLE DE SAISIE. Orthogonal à `nature` (qualité, nature.js)
   et à `code` (pastille rugby, tokens.js). Le type détermine : l'éditeur et les
   champs proposés, le filtre appliqué à la bibliothèque d'exercices, et les
   valeurs par DÉFAUT de nature/code (que l'utilisateur peut ensuite changer).

   Vocabulaire CONTRÔLÉ ici (pas d'enum en base, cf. migration 0110) — jumeau
   conceptuel de nature.js. Purement descriptif : AUCUNE formule de charge
   (sRPE = RPE × durée), de points ou de compliance n'en dépend. */

// ── Types de séance (modèle de saisie) ──────────────────────────────────────
export const SESSION_TYPES = [
  "strength",     // 🏋️ Salle / muscu — sets × reps × kg (comportement actuel)
  "conditioning", // 🏃 Cardio / conditioning — blocs distance/temps/intensité
  "bodyweight",   // 🤸 Poids de corps — sets × reps, kg optionnel (lest)
  "skills",       // 🎯 Technique — sets × reps OU durée, sans charge
  "mixed",        // ⚡ Mixte — plusieurs blocs de types différents
];

export const DEFAULT_SESSION_TYPE = "strength";

export const SESSION_TYPE_ICON = {
  strength: "🏋️",
  conditioning: "🏃",
  bodyweight: "🤸",
  skills: "🎯",
  mixed: "⚡",
};

// Défauts pré-remplis par le type (modifiables ensuite). Renvoient des valeurs
// valides de nature.js / tokens.js.
export const TYPE_DEFAULT_NATURE = {
  strength: "force",
  conditioning: "conditioning",
  bodyweight: "force",
  skills: "technique",
  mixed: "autre",
};

export const TYPE_DEFAULT_CODE = {
  strength: "RS",
  conditioning: "CSB",
  bodyweight: "RS",
  skills: "AC",
  mixed: "RS",
};

/* Filtre bibliothèque par type — DESCRIPTEUR déclaratif consommé par la couche
   data / l'UI pour construire la requête (colonnes réelles d'exercise_library,
   cf. migrations 0053/0083). `null` = aucun filtre (tous les exercices).
   - bodyPart      : exercise_library.body_part = …
   - equipment     : exercise_library.equipment = …
   - noEquipment   : exercise_library.no_equipment = true
   - exerciseType  : exercise_library.exercise_type ∈ […]
   - calisthenics  : exercise_library.is_calisthenics = true
   Les clés d'un même descripteur se combinent en OU logique (un exo qui matche
   AU MOINS un critère est pertinent) — l'implémentation requête vit en PR2. */
export const TYPE_LIBRARY_FILTER = {
  strength: null,
  conditioning: { bodyPart: "cardio" },
  bodyweight: { equipment: "body weight", noEquipment: true },
  skills: { exerciseType: ["skill_statique", "skill_dynamique", "freestyle"], calisthenics: true },
  mixed: null,
};

// ── Kinds de bloc (forme d'un élément de `sessions.exercises`) ───────────────
// Un item sans `kind` = 'strength' (rétro-compat : anciennes séances/protocoles).
export const BLOCK_KINDS = [
  "strength",
  "bodyweight",
  "skill",
  "cardio_continuous",
  "cardio_interval",
  "cardio_circuit",
  "cardio_test",
];

export const DEFAULT_BLOCK_KIND = "strength";

// Kinds cardio (saisie distance/temps/intensité, pas de charge kg).
const CARDIO_KINDS = new Set(["cardio_continuous", "cardio_interval", "cardio_circuit", "cardio_test"]);

// Kinds portant une charge externe en kg (barre/haltère). Le poids de corps
// n'en porte PAS par défaut (lest = option), le skill/cardio jamais.
const LOAD_KINDS = new Set(["strength"]);

// Kinds proposant un tableau de séries/répétitions cochables (grille de saisie).
const SETLIKE_KINDS = new Set(["strength", "bodyweight", "skill", "cardio_interval"]);

// Kinds autorisés par type de séance (ce que le builder peut ajouter).
export const TYPE_ALLOWED_KINDS = {
  strength: ["strength"],
  conditioning: ["cardio_continuous", "cardio_interval", "cardio_circuit", "cardio_test"],
  bodyweight: ["bodyweight"],
  skills: ["skill"],
  mixed: BLOCK_KINDS, // le mixte combine tout
};

// ── Helpers purs ────────────────────────────────────────────────────────────

// Valide/normalise un type de séance. Repli 'strength' (défaut Salle).
export const normalizeSessionType = (v) => (SESSION_TYPES.includes(v) ? v : DEFAULT_SESSION_TYPE);

// Type effectif : valeur stockée si valide, sinon défaut (séances antérieures à
// 0110 lues comme 'strength'). Symétrique de effectiveNature.
export const effectiveSessionType = (sessionType) => normalizeSessionType(sessionType);

// Kind effectif d'un bloc : `kind` s'il est connu, sinon 'strength' (legacy).
export const blockKind = (block) => {
  const k = block && block.kind;
  return BLOCK_KINDS.includes(k) ? k : DEFAULT_BLOCK_KIND;
};

export const kindIsCardio = (kind) => CARDIO_KINDS.has(kind);

// Le kind porte-t-il une charge kg saisie ? (strength=oui ; bodyweight=option
// lest → false par défaut ; skill/cardio=non).
export const kindUsesLoad = (kind) => LOAD_KINDS.has(kind);

// Le kind se saisit-il via une grille de séries/répétitions cochables ?
export const kindIsSetLike = (kind) => SETLIKE_KINDS.has(kind);

/* ── Modèle de SAISIE d'un exercice (carte joueur) ────────────────────────────
   Quels CHAMPS proposer pour un exercice donné. Deux sources, dans l'ordre :
   1) le `kind` explicite du bloc (builder conditioning : cardio_*, skill…) fait
      toujours foi — c'est une saisie structurée voulue par le coach ;
   2) sinon (exercice « plat » issu d'une semaine-type / import : {name, sets,
      reps, charge}), on DÉRIVE le modèle de la NATURE de la séance. C'est ce qui
      corrige le défaut « champs de muscu sur une séance cardio » : une ligne sans
      kind héritait de 'strength' (kg + %1RM) quelle que soit la nature.

   Modèles de saisie (au-delà des kinds de bloc) :
   - strength   : séries × reps × kg (+ %1RM)           ← force / prévention
   - conditioning : temps / distance / watts / kcal / allure (pas de kg)
   - vitesse    : distance / temps / répétitions / récup (pas de kg)
   - mobility   : durée / tenue (pas de kg)             ← mobilité / récupération
   - skill      : reps OU tenue, sans charge            ← technique                */
export const INPUT_MODELS = [
  "strength", "bodyweight", "skill", "conditioning", "vitesse", "mobility",
  "cardio_continuous", "cardio_interval", "cardio_circuit", "cardio_test",
];
export const DEFAULT_INPUT_MODEL = "strength";

// Nature (nature.js) → modèle de saisie par défaut d'un exercice SANS kind.
export const NATURE_INPUT_MODEL = {
  force: "strength",
  prevention: "strength",
  conditioning: "conditioning",
  vitesse: "vitesse",
  mobilite: "mobility",
  recuperation: "mobility",
  technique: "skill",
  autre: "strength",
};

// Modèles « effort » (bloc mono : pas de grille séries × reps × kg cochable).
const EFFORT_MODELS = new Set(["conditioning", "vitesse", "mobility"]);
export const inputModelIsEffort = (m) => EFFORT_MODELS.has(m);

// Le modèle porte-t-il une charge externe kg ? (strength/bodyweight oui — lest ;
// skill/effort/cardio non). Le %1RM n'a de sens que pour 'strength'.
const LOAD_MODELS = new Set(["strength", "bodyweight"]);
export const inputModelUsesLoad = (m) => LOAD_MODELS.has(m);

// Modèle de saisie effectif d'un exercice, selon son bloc puis la nature de la
// séance. PUR. `nature` = nature EFFECTIVE de la séance (effectiveNature).
export function exerciseInputModel(exo, nature) {
  const k = exo && exo.kind;
  if (BLOCK_KINDS.includes(k)) return k;                 // bloc structuré : le kind fait foi
  return NATURE_INPUT_MODEL[nature] || DEFAULT_INPUT_MODEL;
}

export const natureForType = (type) => TYPE_DEFAULT_NATURE[normalizeSessionType(type)];
export const codeForType = (type) => TYPE_DEFAULT_CODE[normalizeSessionType(type)];
export const allowedKindsForType = (type) => TYPE_ALLOWED_KINDS[normalizeSessionType(type)];
export const libraryFilterForType = (type) => TYPE_LIBRARY_FILTER[normalizeSessionType(type)] || null;
export const sessionTypeIcon = (type) => SESSION_TYPE_ICON[normalizeSessionType(type)];

// Libellé traduit ; repli sur la clé brute si non traduit (comme natureLabel).
export const sessionTypeLabel = (t, key) => t(`data.sessionType.${key}`, { defaultValue: key || "" });
