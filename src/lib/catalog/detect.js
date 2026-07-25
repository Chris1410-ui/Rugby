/* Détection du TYPE FONCTIONNEL d'une section de protocole (échauffement, force,
   superset, cardio, prévention, mobilité, récupération, checklist, planning…).
   Déterministe et pur (aucun LLM, aucun réseau) — testable. La classification
   part du `type` structurel de la section puis affine par mots-clés (FR d'abord).
   Le LLM viendra plus tard raffiner les cas ambigus (hors PR1). */

// Normalise un texte pour la recherche de mots-clés : sans accents, minuscule.
export function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

// Dictionnaires de mots-clés par type fonctionnel (déjà normalisés — sans accent).
const KIND_KEYWORDS = {
  warmup: ["echauffement", "activation", "mise en train", "gammes", "mobilisation articulaire", "preparation musculaire"],
  mobility: ["mobilite", "etirement", "souplesse", "assouplissement", "foam", "rouleau", "amplitude"],
  recovery: ["recuperation", "recup", "sommeil", "hydratation", "nutrition", "coherence cardiaque", "retour au calme", "decrassage", "massage"],
  prevention: ["prevention", "prophylaxie", "nuque", "cervicale", "proprioception", "proprio", "cheville", "ischio", "epaule", "commotion", "gainage preventif", "renfo preventif"],
  cardio: ["cardio", "course", "fractionne", "vma", "rameur", "velo", "aerobie", "anaerobie", "intervalle", "conditioning", "hiit", "endurance", "footing"],
  strength: ["force", "renforcement", "musculation", "squat", "developpe", "souleve de terre", "hypertrophie", "charge", "rep max", "1rm", "haltere", "barre"],
};

// Concatène le texte pertinent d'une section (titre, sous-titre, corps, noms de
// lignes/items et notes) pour la détection par mots-clés.
export function sectionText(section) {
  const s = section || {};
  const parts = [s.title, s.subtitle, s.body, s.badge];
  if (Array.isArray(s.rows)) s.rows.forEach((r) => parts.push(r?.name, r?.note, r?.block));
  if (Array.isArray(s.items)) s.items.forEach((it) => parts.push(typeof it === "string" ? it : `${it?.name} ${it?.kind} ${it?.target} ${it?.note}`));
  if (Array.isArray(s.days)) s.days.forEach((d) => parts.push(d?.label, d?.nature));
  return norm(parts.filter(Boolean).join(" "));
}

// Supersets : au moins deux lignes partageant la même LETTRE de bloc (A1, A2…).
export function hasSupersets(section) {
  const rows = Array.isArray(section?.rows) ? section.rows : [];
  const letters = {};
  for (const r of rows) {
    const m = String(r?.block || "").trim().match(/^([A-Za-z])\s*\d/);
    if (m) { const L = m[1].toUpperCase(); letters[L] = (letters[L] || 0) + 1; }
  }
  return Object.values(letters).some((n) => n >= 2);
}

// Compte les mots-clés d'un type présents dans le texte.
function scoreKind(text, kind) {
  return KIND_KEYWORDS[kind].reduce((n, kw) => (text.includes(kw) ? n + 1 : n), 0);
}

/* Détecte le type fonctionnel d'une section. `meta` (nature dominante du
   protocole) sert de repli. Retourne une clé stable de KIND. */
export function detectSectionKind(section, meta = {}) {
  const type = section?.type;
  if (type === "checklist") return "checklist";
  if (type === "weekcalendar") return "planning";
  if (type === "cardio") return "cardio";

  const text = sectionText(section);
  // Meilleur type par mots-clés (départage : ordre de priorité prévention >
  // cardio > récup > mobilité > échauffement > force en cas d'égalité).
  const order = ["prevention", "cardio", "recovery", "mobility", "warmup", "strength"];
  let best = null, bestScore = 0;
  for (const kind of order) {
    const sc = scoreKind(text, kind);
    if (sc > bestScore) { best = kind; bestScore = sc; }
  }
  if (bestScore > 0) {
    // Un tableau d'exercices « force » couplé → superset.
    if (best === "strength" && type === "exercises" && hasSupersets(section)) return "superset";
    return best;
  }

  // Aucun mot-clé : repli sur la structure + la nature du protocole.
  if (type === "exercises") return hasSupersets(section) ? "superset" : "strength";
  if (type === "narrative") {
    const byNature = NATURE_TO_KIND[norm(meta?.nature)];
    return byNature || "note";
  }
  if (type === "table") return "table";
  return "other";
}

// Nature dominante du protocole → type de section (repli pour narratif sans mot-clé).
const NATURE_TO_KIND = {
  force: "strength", conditioning: "cardio", vitesse: "cardio",
  prevention: "prevention", recuperation: "recovery", mobilite: "mobility",
  technique: "note",
};

// Types fonctionnels connus (ordre d'affichage / libellés i18n catalog.kind.*).
export const SECTION_KINDS = [
  "warmup", "strength", "superset", "cardio", "prevention",
  "mobility", "recovery", "checklist", "planning", "table", "note", "other",
];
