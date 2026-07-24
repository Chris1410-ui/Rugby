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

export const SECTION_TYPES = ["narrative", "exercises", "checklist", "weekcalendar", "cardio", "table"];

// Jours (semaine type / weekcalendar). Lundi=1 … Dimanche=0 (getDay JS).
export const WEEKDAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAY_TO_WD = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
export function dayToWeekday(d) {
  if (typeof d === "number" && d >= 0 && d <= 6) return d;
  const k = String(d || "").trim().toLowerCase();
  return k in DAY_TO_WD ? DAY_TO_WD[k] : null;
}

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

// ── Nouveaux types (fidélité d'import : échauffement, semaine type, cardio, tableaux) ──
export function emptyChecklistSection() {
  return { id: uid(), type: "checklist", num: "", title: "", subtitle: "", badge: "", items: [""] };
}
export function emptyWeekCalendarSection() {
  return { id: uid(), type: "weekcalendar", num: "", title: "", subtitle: "", days: [] };
}
export function emptyCardioSection() {
  return { id: uid(), type: "cardio", num: "", title: "", subtitle: "", items: [{ name: "", kind: "", target: "", note: "" }] };
}
export function emptyTableSection() {
  return { id: uid(), type: "table", num: "", title: "", subtitle: "", columns: ["", ""], rows: [["", ""]] };
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
    nature: "",          // nature dominante du protocole (lib/nature.js) ; "" = non précisée
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

const asStr = (v) => (typeof v === "string" ? v : "");
const head = (s) => ({ id: s.id || uid(), num: asStr(s.num), title: asStr(s.title), subtitle: asStr(s.subtitle) });

function normalizeChecklist(s) {
  return { ...head(s), type: "checklist", badge: asStr(s.badge),
    items: (Array.isArray(s.items) ? s.items : []).map((x) => (typeof x === "string" ? x : asStr(x?.text))).filter((x) => x != null) };
}
function normalizeWeekCalendar(s) {
  const days = (Array.isArray(s.days) ? s.days : []).map((d) => ({
    weekday: dayToWeekday(d?.weekday ?? d?.day),
    label: asStr(d?.label),
    nature: asStr(d?.nature),
    optional: Boolean(d?.optional),
    off: Boolean(d?.off),
  })).filter((d) => d.weekday != null || d.label);
  return { ...head(s), type: "weekcalendar", days };
}
function normalizeCardio(s) {
  return { ...head(s), type: "cardio",
    items: (Array.isArray(s.items) ? s.items : []).map((it) => ({
      name: asStr(it?.name), kind: asStr(it?.kind), target: asStr(it?.target), note: asStr(it?.note),
    })).filter((it) => it.name || it.target) };
}
function normalizeTable(s) {
  const cols = (Array.isArray(s.columns) ? s.columns : []).map(asStr);
  const rows = (Array.isArray(s.rows) ? s.rows : []).map((r) => (Array.isArray(r) ? r.map(asStr) : []));
  return { ...head(s), type: "table", columns: cols, rows };
}
function normalizeExercises(s, w) {
  const labels = Array.isArray(s.weekLabels) && s.weekLabels.length ? s.weekLabels : defaultWeekLabels(w);
  const accents = Array.isArray(s.weekAccents) && s.weekAccents.length ? s.weekAccents : defaultWeekAccents(w);
  return {
    ...head(s), type: "exercises",
    weekLabels: Array.from({ length: w }, (_, i) => labels[i] ?? `S${i + 1}`),
    weekAccents: Array.from({ length: w }, (_, i) => (ACCENTS.includes(accents[i]) ? accents[i] : "c")),
    rows: (Array.isArray(s.rows) ? s.rows : []).map((r) => normalizeRow(r, w)),
  };
}

function normalizeSection(sec, w) {
  const s = sec || {};
  switch (s.type) {
    case "narrative": return { ...head(s), type: "narrative", body: asStr(s.body) };
    case "checklist": return normalizeChecklist(s);
    case "weekcalendar": return normalizeWeekCalendar(s);
    case "cardio": return normalizeCardio(s);
    case "table": return normalizeTable(s);
    case "exercises": return normalizeExercises(s, w);
    default:
      // Type inconnu : on préserve au mieux (rows → exercices, items → checklist,
      // sinon narrative) pour ne pas perdre de contenu importé.
      if (Array.isArray(s.rows)) return normalizeExercises(s, w);
      if (Array.isArray(s.days)) return normalizeWeekCalendar(s);
      if (Array.isArray(s.items)) return normalizeChecklist(s);
      return { ...head(s), type: "narrative", body: asStr(s.body) };
  }
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
