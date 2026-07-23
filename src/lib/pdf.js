import { newExo } from "./exlib.js";

/* Import PDF → programme (séances éditables) avec APERÇU et VALIDATION manuelle
   obligatoires (le parse PDF est faillible : rien n'est écrit sans confirmation,
   et les lignes non comprises sont signalées).

   Découpage :
   - extractPdfLines(file)  : pdf.js (chunk dynamique) → lignes de texte brutes.
   - parseLinesToProgram(lines) : PUR & testable → { sessions, warnings, unread }.
   - parseProgramPdf(file)  : enchaîne les deux. */

// ── Détection de la NATURE par mots-clés (repli "" = à préciser à la main) ──
const NATURE_HINTS = [
  ["prevention", /(pr[ée]vention|pr[ée]hab|prehab|proprio|nordic|ischio|cheville|[ée]paule)/i],
  ["recuperation", /(r[ée]cup|recovery|[ée]tirement|foam|souplesse|d[ée]contract)/i],
  ["mobilite", /(mobilit[ée]|mobility)/i],
  ["vitesse", /(vitesse|acc[ée]l[ée]ration|agilit[ée]|appuis|changement de direction|speed|sprint)/i],
  ["conditioning", /(cardio|conditioning|intermittent|30-?15|vma|a[ée]robie|rameur|wattbike|assault|course|endurance|filière)/i],
  ["technique", /(technique|plaquage|passe|ballon|ruck|m[êe]l[ée]e|skills|jeu au pied)/i],
  ["force", /(force|renforc|squat|d[ée]velopp[ée]|soulev[ée]|deadlift|bench|hip thrust|fente|traction|gainage|puissance|halt[èe]re|barre)/i],
];
export function detectNature(text) {
  const s = String(text || "");
  for (const [key, re] of NATURE_HINTS) if (re.test(s)) return key;
  return "";
}

const WD_RE = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;
const WD_MAP = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
// En-tête de séance : un jour, ou « Séance 2 » / « Jour 3 » / « J2 » / « Bloc 1 ».
const HEADER_RE = /^(?:s[ée]ance|jour|bloc|j)\s*\d/i;
// Schéma séries×reps : « 4x8 », « 3 × 10-12 », « 4*6 », « 3 séries de 8 ».
const SCHEME_RE = /(\d+)\s*(?:[x×*]|s[ée]ries?\s*(?:de|x)?)\s*([\d]+(?:\s*[-–à]\s*\d+)?)/i;
const CHARGE_RE = /(\d+\s*%|\d+\s*(?:kg|rm)|@\s*\d+|pdc|poids de corps)/i;
// Ligne qui « ressemble » à un exercice (mot-clé courant) même sans schéma.
const EXO_HINT_RE = /(squat|press|d[ée]velopp|hip|sprint|nordic|gainage|fente|traction|soulev|deadlift|jump|saut[ée]|mobilit|plaquage|pompe|tirage|rowing|curl|extension|planche|burpee|corde|m[ée]decine|lunge|thrust|bench|clean|[ée]paul[ée]|snatch)/i;

const cleanName = (s) => String(s || "").replace(/^[-•·*\d.)\s]+/, "").trim();

// Une ligne est-elle « du bruit » (pied de page, date, numéro seul) ?
const isNoise = (s) =>
  !/[a-zà-ÿ]{3,}/i.test(s) ||                         // pas d'au moins 3 lettres
  /^\s*(page\s*)?\d+\s*(\/\s*\d+)?\s*$/i.test(s) ||    // « 3 », « 3/8 », « page 2 »
  /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/.test(s);      // date

// Parse une ligne d'exercice → { name, sets, reps, charge } (ou null si vide).
function parseExo(line) {
  const m = line.match(SCHEME_RE);
  const exo = newExo();
  if (m) {
    exo.sets = parseInt(m[1], 10) || 3;
    exo.reps = m[2].replace(/\s+/g, "").replace(/[–à]/g, "-");
    exo.name = cleanName(line.slice(0, m.index)) || cleanName(line);
    const cm = line.slice(m.index + m[0].length).match(CHARGE_RE);
    if (cm) exo.charge = cm[0].trim();
  } else {
    exo.name = cleanName(line);
    const cm = line.match(CHARGE_RE);
    if (cm) exo.charge = cm[0].trim();
  }
  return exo.name.length > 1 ? exo : null;
}

/* Cœur PUR : lignes → { sessions, warnings, unread }. `sessions` sont des
   modèles éditables { weekday|null, nature, code, titre, exercises[] }. */
export function parseLinesToProgram(lines) {
  const sessions = [];
  const unread = [];
  let cur = null;

  for (const raw of lines || []) {
    const line = String(raw).replace(/\s+/g, " ").trim();
    if (!line) continue;

    // En-tête de séance (jour ou « Séance N ») — court, pas une phrase d'exo.
    const wm = line.match(WD_RE);
    const isHeader = (wm || HEADER_RE.test(line)) && line.length < 48 && !SCHEME_RE.test(line);
    if (isHeader) {
      cur = { weekday: wm ? WD_MAP[wm[1].toLowerCase()] : null, nature: detectNature(line), code: "RS", titre: line, exercises: [] };
      sessions.push(cur);
      continue;
    }

    // Ligne d'exercice (schéma NxR ou mot-clé d'exercice).
    if (SCHEME_RE.test(line) || EXO_HINT_RE.test(line)) {
      const exo = parseExo(line);
      if (exo) {
        if (!cur) { cur = { weekday: null, nature: "", code: "RS", titre: "Séance importée", exercises: [] }; sessions.push(cur); }
        if (!cur.nature) cur.nature = detectNature(line);
        cur.exercises.push(exo);
        continue;
      }
    }

    // Reste : signalé comme « non compris » si ce n'est pas du bruit évident.
    if (!isNoise(line) && line.length <= 80) unread.push(line);
  }

  // Séances sans exercice → écartées (mais signalées).
  const kept = sessions.filter((s) => s.exercises.length);
  const dropped = sessions.length - kept.length;

  const warnings = [];
  if (!kept.length) warnings.push({ code: "empty" });
  kept.forEach((s) => {
    if (s.weekday == null) warnings.push({ code: "noDay", titre: s.titre });
    if (!s.nature) warnings.push({ code: "noNature", titre: s.titre });
  });
  if (dropped > 0) warnings.push({ code: "droppedEmpty", count: dropped });
  if (unread.length) warnings.push({ code: "unread", count: unread.length });

  // Défaut de jour : lundi, mardi… pour que ce soit éditable sans blocage.
  kept.forEach((s, i) => { if (s.weekday == null) s.weekday = (i % 7); });

  return { sessions: kept, warnings, unread: unread.slice(0, 40) };
}

// ── Extraction du texte (pdf.js, chargé dynamiquement) ──
export async function extractPdfLines(file) {
  let pdfjsLib, workerUrl;
  try {
    pdfjsLib = await import("pdfjs-dist");
    workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    throw new Error("no-pdfjs");
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const page = await pdf.getPage(pg);
    const tc = await page.getTextContent();
    const byY = {};
    tc.items.forEach((it) => {
      const y = Math.round(it.transform[5]);
      (byY[y] = byY[y] || []).push(it.str);
    });
    Object.keys(byY).map(Number).sort((a, b) => b - a).forEach((y) => {
      const t = byY[y].join(" ").replace(/\s+/g, " ").trim();
      if (t) lines.push(t);
    });
  }
  return lines;
}

// Enchaîne extraction + parse. Renvoie { sessions, warnings, unread }.
export async function parseProgramPdf(file) {
  const lines = await extractPdfLines(file);
  return parseLinesToProgram(lines);
}
