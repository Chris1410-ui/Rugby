/* Modèles de SECTIONS pré-remplis pour le constructeur de protocoles.
   Les modèles FOURNIS (curés) vivent ici, en constantes — chaque entrée est une
   fabrique build(weeks) qui renvoie UN OU PLUSIEURS objets section normalisés
   (progression indicative sur N semaines, tronquée/complétée selon le protocole).
   Les modèles ENREGISTRÉS par le staff vivent en base (table section_templates).
   Contenu en français (comme le thème de référence) ; les LIBELLÉS du menu sont
   traduits (nameKey). Tout reste éditable après insertion. */
import { emptyExerciseSection, emptyNarrativeSection, emptyRow, clampWeeks, uid } from "./model.js";

function row(weeks, { block = "", name = "", tempo = "", rest = "", cells = [], note = "", peakAt = -1 }) {
  const w = clampWeeks(weeks);
  const r = emptyRow(w);
  r.block = block; r.name = name; r.tempo = tempo; r.rest = rest; r.note = note;
  r.weeks = Array.from({ length: w }, (_, i) => ({ text: cells[i] ?? "", peak: i === peakAt }));
  return r;
}
function exSection(weeks, title, rows) {
  const s = emptyExerciseSection(clampWeeks(weeks));
  s.title = title; s.rows = rows;
  return s;
}
function narrative(title, body) {
  const s = emptyNarrativeSection();
  s.title = title; s.body = body;
  return s;
}

// Cardio — course continue, fractionné, machine. Progression indicative S1→S4.
const buildCardio = (weeks) => [exSection(weeks, "Cardio", [
  row(weeks, { block: "1", name: "Course continue (base aérobie)", rest: "continu", cells: ["30′", "35′", "40′", "30′ souple"], note: "Faible intensité, footing ou vélo." }),
  row(weeks, { block: "2", name: "Fractionné 30/30", rest: "récup 30s", cells: ["8×", "10×", "12×", "6×"], note: "Haute intensité : 30s effort / 30s récup." }),
  row(weeks, { block: "3", name: "Vélo / Rameur — intervalles", rest: "récup 1′", cells: ["6×500 m", "8×500 m", "8×400 m", "5×500 m"], note: "Machine au choix, à alterner." }),
])];

// Renforcement en salle — blocs A/B/C, RPE + surcharge progressive.
const buildStrength = (weeks) => [exSection(weeks, "Renforcement en salle", [
  row(weeks, { block: "A1", name: "Squat", tempo: "2010", rest: "3-4 min", cells: ["4×8 R7", "4×6 R8", "5×5 R8", "3×5 R7"], note: "Amplitude complète, montée en charge.", peakAt: 1 }),
  row(weeks, { block: "A2", name: "Gainage face (lesté)", tempo: "ISO", rest: "—", cells: ["3×30s", "3×35s", "3×40s", "3×30s"], note: "Anti-extension." }),
  row(weeks, { block: "B1", name: "Développé couché", tempo: "2010", rest: "3 min", cells: ["4×8 R7", "4×6 R8", "5×5 R8", "3×5 R7"], note: "Variante incliné possible.", peakAt: 1 }),
  row(weeks, { block: "B2", name: "Tirage (rowing buste penché)", tempo: "2010", rest: "—", cells: ["4×8", "4×8", "5×6", "3×8"], note: "Dos gainé, tirage complet." }),
  row(weeks, { block: "C1", name: "Fente marchée haltères", tempo: "2010", rest: "2 min", cells: ["4×6/c", "4×6/c", "4×5/c", "3×5/c"], note: "Attention à la charge." }),
])];

// Récupération — bloc texte (consignes) + tableau mobilité / auto-massage.
const buildRecovery = (weeks) => [
  narrative("Récupération",
    "Objectif : mieux récupérer pour repartir frais.\n\n"
    + "- **Sommeil** : 8 h minimum, horaires réguliers.\n"
    + "- **Hydratation** : +++ surtout par forte chaleur.\n"
    + "- **Nutrition** : protéines + glucides dans les 60 min après l'effort.\n\n"
    + "> Toute douleur ou gêne : adapte ou stoppe l'exercice, et préviens le préparateur physique."),
  exSection(weeks, "Mobilité & auto-massage", [
    row(weeks, { block: "1", name: "Foam roller (11 zones)", rest: "—", cells: ["5′", "5′", "5′", "5′"], note: "Voûte, mollets, ischios, quadris, fessiers, dos…" }),
    row(weeks, { block: "2", name: "Étirements / mobilité", rest: "—", cells: ["8′", "8′", "8′", "8′"], note: "Bassin, thoracique, chevilles, épaules." }),
    row(weeks, { block: "3", name: "Respiration / cohérence cardiaque", rest: "—", cells: ["5′", "5′", "5′", "5′"], note: "Retour au calme." }),
  ]),
];

/* Modèles fournis. `build(weeks)` renvoie un TABLEAU de sections (Récupération en
   contient deux : narrative + exercices). `nameKey` = libellé traduit du menu. */
export const BUILTIN_SECTION_TEMPLATES = [
  { id: "cardio", nameKey: "protocols.tplCardio", build: buildCardio },
  { id: "recovery", nameKey: "protocols.tplRecovery", build: buildRecovery },
  { id: "strength", nameKey: "protocols.tplStrength", build: buildStrength },
];

// Réattribue des ids frais à une section + ses lignes (insertion multiple sûre).
export function freshSection(section) {
  const c = JSON.parse(JSON.stringify(section));
  c.id = uid();
  if (Array.isArray(c.rows)) c.rows = c.rows.map((r) => ({ ...r, id: uid() }));
  return c;
}
