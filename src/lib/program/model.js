/* Modèle de données d'un PROTOCOLE (programme d'entraînement riche) — pur et
   testable, sans i18n ni accès réseau. Un protocole = métadonnées (hero) + une
   liste ordonnée de sections, chacune « narrative » (texte Markdown-léger) ou
   « exercices » (tableau avec une progression cellule par cellule sur N semaines).

   Le contenu riche vit dans un unique objet `doc` = { meta, sections[] } stocké
   en JSONB. Ces fabriques garantissent une forme stable et réparent les
   documents partiels (ids manquants, nombre de semaines modifié…). */

export const MIN_WEEKS = 1;
export const MAX_WEEKS = 12;

// Codes d'accent couleur du thème « stade » : cyan (intensité/vitesse),
// ambre (volume/force), fumée (affûtage), rouge (obligatoire), vert (validé).
export const ACCENTS = ["c", "a", "m", "r", "v"];

export const SECTION_TYPES = ["narrative", "exercises"];

export const uid = () =>
  globalThis.crypto?.randomUUID?.() || `p${Math.random().toString(36).slice(2, 10)}`;

export const clampWeeks = (n) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, v)) : 4;
};

export const slugify = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "s";

// Étiquettes par défaut des colonnes semaine : S1…Sn.
export const defaultWeekLabels = (n) => Array.from({ length: clampWeeks(n) }, (_, i) => `S${i + 1}`);

// Accents par défaut : les premières semaines en cyan (hypertrophie), l'avant-
// dernière en ambre (force), la dernière en fumée (affûtage) — comme le modèle.
export const defaultWeekAccents = (n) => {
  const w = clampWeeks(n);
  return Array.from({ length: w }, (_, i) => (i === w - 1 ? "m" : i === w - 2 ? "a" : "c"));
};

// Teinte de bloc dérivée de la lettre (A/B = force ambre, C/D = cyan) ; peut être
// surchargée par row.tint ('a' | 'c' | 'r').
export const blockTint = (block) => {
  const L = String(block || "").trim().charAt(0).toUpperCase();
  if (L === "A" || L === "B") return "a";
  if (L === "C" || L === "D") return "c";
  return "c";
};

const emptyCell = () => ({ text: "", peak: false });

export function emptyRow(weeks = 4) {
  const w = clampWeeks(weeks);
  return {
    id: uid(),
    block: "",
    exerciseRef: null,   // ref stable de exercise_library (lien bibliothèque)
    exerciseId: null,    // uuid de exercise_library (lien fiche)
    name: "",            // nom affiché (libre OU pré-rempli depuis la fiche)
    tempo: "",
    rest: "",
    weeks: Array.from({ length: w }, emptyCell),
    note: "",
    tint: "",            // '' = auto (blockTint) ; 'a' | 'c' | 'r' pour forcer
  };
}

export function emptyExerciseSection(weeks = 4) {
  const w = clampWeeks(weeks);
  return {
    id: uid(),
    type: "exercises",
    num: "",
    title: "",
    subtitle: "",
    weekLabels: defaultWeekLabels(w),
    weekAccents: defaultWeekAccents(w),
    rows: [emptyRow(w)],
  };
}

export function emptyNarrativeSection() {
  return { id: uid(), type: "narrative", num: "", title: "", subtitle: "", body: "" };
}

export function emptyMeta(weeks = 4) {
  const w = clampWeeks(weeks);
  return {
    eyebrow: "",
    badge: { big: "", tag: "" },
    title: "",
    lede: "",
    facts: [],           // [{ n, label, accent }]
    sources: "",
    startDate: null,
    endDate: null,
    sessionsPerWeek: null,
    weeks: w,
    weekLabels: defaultWeekLabels(w),
    mantra: "",
  };
}

export function emptyProgram(weeks = 4) {
  return { meta: emptyMeta(weeks), sections: [] };
}

// Ramène un tableau de cellules à exactement `w` cellules (tronque / complète).
const resizeCells = (cells, w) => {
  const out = [];
  for (let i = 0; i < w; i++) {
    const c = Array.isArray(cells) ? cells[i] : null;
    out.push({ text: c && typeof c.text === "string" ? c.text : "", peak: Boolean(c && c.peak) });
  }
  return out;
};

function normalizeRow(row, w) {
  const r = row || {};
  return {
    id: r.id || uid(),
    block: typeof r.block === "string" ? r.block : "",
    exerciseRef: r.exerciseRef ?? null,
    exerciseId: r.exerciseId ?? null,
    name: typeof r.name === "string" ? r.name : "",
    tempo: typeof r.tempo === "string" ? r.tempo : "",
    rest: typeof r.rest === "string" ? r.rest : "",
    weeks: resizeCells(r.weeks, w),
    note: typeof r.note === "string" ? r.note : "",
    tint: ACCENTS.includes(r.tint) ? r.tint : "",
  };
}

function normalizeSection(sec, w) {
  const s = sec || {};
  if (s.type === "narrative") {
    return {
      id: s.id || uid(), type: "narrative",
      num: typeof s.num === "string" ? s.num : "",
      title: typeof s.title === "string" ? s.title : "",
      subtitle: typeof s.subtitle === "string" ? s.subtitle : "",
      body: typeof s.body === "string" ? s.body : "",
    };
  }
  // défaut : section d'exercices
  const labels = Array.isArray(s.weekLabels) && s.weekLabels.length ? s.weekLabels : defaultWeekLabels(w);
  const accents = Array.isArray(s.weekAccents) && s.weekAccents.length ? s.weekAccents : defaultWeekAccents(w);
  return {
    id: s.id || uid(), type: "exercises",
    num: typeof s.num === "string" ? s.num : "",
    title: typeof s.title === "string" ? s.title : "",
    subtitle: typeof s.subtitle === "string" ? s.subtitle : "",
    weekLabels: Array.from({ length: w }, (_, i) => labels[i] ?? `S${i + 1}`),
    weekAccents: Array.from({ length: w }, (_, i) => (ACCENTS.includes(accents[i]) ? accents[i] : "c")),
    rows: (Array.isArray(s.rows) ? s.rows : []).map((r) => normalizeRow(r, w)),
  };
}

/* Répare/complète un document pour un nombre de semaines donné : garantit meta,
   redimensionne toutes les grilles d'exercices, assigne les ids manquants. */
export function normalizeProgram(doc, weeks) {
  const src = doc && typeof doc === "object" ? doc : {};
  const w = clampWeeks(weeks ?? src.meta?.weeks ?? 4);
  const meta = { ...emptyMeta(w), ...(src.meta || {}) };
  meta.weeks = w;
  meta.badge = { big: "", tag: "", ...(src.meta?.badge || {}) };
  meta.facts = Array.isArray(src.meta?.facts) ? src.meta.facts : [];
  meta.weekLabels = Array.from({ length: w }, (_, i) => src.meta?.weekLabels?.[i] ?? `S${i + 1}`);
  const sections = (Array.isArray(src.sections) ? src.sections : []).map((s) => normalizeSection(s, w));
  return { meta, sections };
}

/* Change le nombre de semaines : redimensionne meta + toutes les sections
   d'exercices (les colonnes en trop sont retirées, les manquantes ajoutées vides). */
export function changeWeeks(doc, weeks) {
  const w = clampWeeks(weeks);
  const next = normalizeProgram(doc, w);
  return next;
}

// Table des matières (nav collante) : une entrée par section avec ancre stable.
export function toc(doc) {
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  return sections.map((s, i) => ({
    num: s.num || String(i + 1).padStart(2, "0"),
    title: s.title || "",
    anchor: `${slugify(s.title)}-${i}`,
  }));
}

export const isExerciseSection = (s) => s?.type === "exercises";
export const isNarrative = (s) => s?.type === "narrative";
