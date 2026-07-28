/* Matérialisation d'un PROTOCOLE riche (doc = {meta, sections}) vers des
   modèles de SÉANCES plats { weekday, nature, code, titre, exercises[] } — la
   forme attendue par l'aperçu d'import (PdfImportReview) puis par
   expandProgramToRows (freeSessions.js) qui les DATE sur N semaines.

   Pourquoi cette étape : le protocole (program_docs) porte le détail riche que
   le joueur CONSULTE ; les séances datées (table `sessions`) sont ce qui
   alimente le CALENDRIER et l'ANTI-SURCHARGE (présence + nature d'un jour). Un
   protocole n'est pas daté ; on en dérive donc un squelette de séances.

   Fonction PURE & testable. Heuristique volontairement prudente : on ne
   sur-interprète pas. La source de vérité fidèle reste le protocole ; ces
   séances sont éditables avant écriture (validation manuelle obligatoire). */

import { normalizeProgram } from "./model.js";
import { norm } from "../catalog/detect.js";

// Deux titres se « correspondent » si l'un contient l'autre (normalisés) — pour
// rattacher un jour de semaine-type à la grille d'exercices homonyme.
function titlesMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 4 && long.includes(short); // évite qu'un titre trivial (« A ») matche tout
}

// Nature dominante → code rugby par défaut (inverse de nature.js CODE_NATURE).
const NATURE_CODE = {
  force: "RS", vitesse: "COD", conditioning: "CSB",
  technique: "AC", prevention: "BLI", recuperation: "RS",
  mobilite: "RS", autre: "RS",
};
export const codeForNature = (n) => NATURE_CODE[n] || "RS";

// Cellule de semaine « 4×8 R7 » / « 3x10 » → { sets, reps }. Le reste (repos,
// étoile de pic…) reste dans le protocole ; ici on ne garde que sets×reps.
export function parseScheme(text) {
  const m = String(text || "").match(/(\d+)\s*[x×*]\s*(\d+(?:\s*[-–]\s*\d+)?)/);
  if (!m) return { sets: "", reps: "" };
  return { sets: m[1], reps: m[2].replace(/\s+/g, "").replace(/–/g, "-") };
}

// Ligne d'exercices du protocole → exo plat. On prend le schéma de la 1re
// cellule non vide (S1 en général) comme sets×reps indicatif. 1 LIGNE = 1
// EXERCICE : on ne jette JAMAIS la ligne (nom de repli sur le bloc/la cellule)
// et on préserve la consigne prescrite brute `presc` (avec son unité), le tempo
// et la note du coach.
function rowToExo(row) {
  const cell = (Array.isArray(row?.weeks) ? row.weeks : []).map((c) => c?.text).find((x) => x && String(x).trim()) || "";
  const presc = String(cell || "").trim();
  const { sets, reps } = parseScheme(cell);
  const block = String(row?.block || "").trim();
  const name = String(row?.name || "").trim() || block || presc || "Exercice";
  const exo = {
    name,
    sets: sets || "",
    reps: reps || presc,
    charge: "",
    rest: 90,
    tempo: String(row?.tempo || "").trim() || null,
    note: String(row?.note || "").trim() || null,
    presc: presc || null,
  };
  // MODE DÉTAILLÉ PAR SÉRIE (schéma pyramidal d'une cellule) → exo.setPlan, comme
  // planMaterialize. On prend la 1re cellule qui porte des séries. Chaque série :
  // reps + pct(%1RM) OU charge (kg). La carte joueur résout les kg via son 1RM.
  const cellWithSets = (Array.isArray(row?.weeks) ? row.weeks : []).find((c) => Array.isArray(c?.sets) && c.sets.length);
  if (cellWithSets) {
    exo.setPlan = cellWithSets.sets.map((s) => {
      const o = { reps: s.reps ?? "" };
      if (s.pct1rm != null) o.pct = s.pct1rm; else if (s.charge != null) o.charge = s.charge;
      if (s.tempo) o.tempo = s.tempo;
      if (s.rest != null) o.rest = s.rest;
      if (s.note) o.note = s.note;
      return o;
    });
    if (exo.setPlan.some((s) => s.pct != null)) {
      const ref = String(row?.rmRef || "").trim();
      exo.rmLabel = ref || name;                            // référence %1RM commune aux séries
      exo.rmExerciseId = ref ? null : (row?.exerciseId || null);
    }
  }
  const vid = String(row?.video || "").trim();
  if (vid) exo.video = vid;                                 // vidéo de démo de la ligne (parité planMaterialize)
  return exo;
}

const exosOfSection = (s) => (Array.isArray(s?.rows) ? s.rows : []).map(rowToExo).filter(Boolean);

/* doc → séances éditables. `warnings` signale ce qui n'a pas pu être mappé
   proprement (ex: exercices non rattachés à un jour précis). */
export function docToSessions(doc) {
  const d = normalizeProgram(doc, doc?.meta?.weeks ?? 4);
  const sections = d.sections || [];
  const exSecs = sections.filter((s) => s.type === "exercises");
  const wcal = sections.find((s) => s.type === "weekcalendar" && Array.isArray(s.days) && s.days.length);
  const warnings = [];

  // Cas 1 — une « semaine type » existe : chaque jour actif = une séance.
  if (wcal) {
    const active = wcal.days.filter((day) => !day.off && day.weekday != null);
    // Rattachement des exercices : seulement si UNE seule grille d'exercices
    // existe (sinon l'association jour↔grille est ambiguë → on ne devine pas).
    const soleExos = exSecs.length === 1 ? exosOfSection(exSecs[0]) : [];
    if (exSecs.length > 1)
      warnings.push("Plusieurs grilles d'exercices : elles restent dans le protocole (non réparties par jour).");
    const sessions = active.map((day) => {
      const nature = day.nature || "";
      const label = day.label || "Séance";
      // 1) Rapprochement par TITRE : un jour ↔ la grille homonyme (toute nature).
      // 2) Sinon, la grille unique alimente les jours de force ; à défaut,
      //    l'intitulé du jour = une ligne (séance non vide → visible au calendrier).
      const byTitle = exSecs.find((s) => titlesMatch(s.title, label));
      const exos = byTitle ? exosOfSection(byTitle)
        : (soleExos.length && (nature === "force" || /muscu|force|renfo/i.test(label))
          ? soleExos
          : [{ name: label, sets: "", reps: "", charge: "", rest: 90 }]);
      return { weekday: day.weekday, nature, code: codeForNature(nature), titre: label, exercises: exos };
    });
    return { sessions, warnings };
  }

  // Cas 2 — pas de semaine type : chaque grille d'exercices = une séance
  // (jours répartis lun, mar, … pour rester éditable sans blocage).
  if (exSecs.length) {
    const sessions = exSecs.map((s, i) => {
      const exos = exosOfSection(s);
      return {
        weekday: (i % 6) + 1, // lundi..samedi
        nature: d.meta?.nature || "",
        code: codeForNature(d.meta?.nature || ""),
        titre: s.title || `Séance ${i + 1}`,
        exercises: exos.length ? exos : [{ name: s.title || "Séance", sets: "", reps: "", charge: "", rest: 90 }],
      };
    });
    return { sessions, warnings };
  }

  // Aucun contenu daté dérivable : le protocole seul sera enregistré.
  warnings.push("Aucune séance datable (ni semaine type, ni grille d'exercices) : seul le protocole sera enregistré.");
  return { sessions: [], warnings };
}
