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

// Nature dominante → code rugby par défaut (inverse de nature.js CODE_NATURE).
const NATURE_CODE = {
  force: "RS", vitesse: "COD", conditioning: "CSB",
  technique: "AC", prevention: "BLI", recuperation: "RS",
  mobilite: "RS", autre: "RS",
};
export const codeForNature = (n) => NATURE_CODE[n] || "RS";

// Cellule de semaine « 4×8 R7 » / « 3x10 » → { sets, reps }. Le reste (repos,
// étoile de pic…) reste dans le protocole ; ici on ne garde que sets×reps.
function parseScheme(text) {
  const m = String(text || "").match(/(\d+)\s*[x×*]\s*(\d+(?:\s*[-–]\s*\d+)?)/);
  if (!m) return { sets: "", reps: "" };
  return { sets: m[1], reps: m[2].replace(/\s+/g, "").replace(/–/g, "-") };
}

// Ligne d'exercices du protocole → exo plat. On prend le schéma de la 1re
// cellule non vide (S1 en général) comme sets×reps indicatif ; le tempo devient
// une charge/indication si présent.
function rowToExo(row) {
  const name = String(row?.name || "").trim();
  if (!name) return null;
  const cell = (Array.isArray(row?.weeks) ? row.weeks : []).map((c) => c?.text).find((x) => x && String(x).trim()) || "";
  const { sets, reps } = parseScheme(cell);
  return {
    name,
    sets: sets || "",
    reps: reps || (cell ? String(cell).trim() : ""),
    charge: String(row?.tempo || "").trim(),
    rest: 90,
  };
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
      // On rattache la grille unique aux jours de FORCE ; sinon l'intitulé du
      // jour sert d'unique ligne (séance non vide → visible au calendrier).
      const exos = soleExos.length && (nature === "force" || /muscu|force|renfo/i.test(label))
        ? soleExos
        : [{ name: label, sets: "", reps: "", charge: "", rest: 90 }];
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
