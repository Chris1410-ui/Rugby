/* Planification d'un PROTOCOLE (program_docs) → séances datées, en déroulant la
   progression S1→Sn sur les VRAIES semaines. Pur & testable (aucun réseau).

   Différence clé avec `expandProgramToRows` (freeSessions) : là, chaque semaine
   répète le même contenu. Ici, la semaine réelle k utilise la cellule Sₖ de
   chaque ligne d'exercice → la charge/volume progresse comme prévu au protocole.

   Deux étapes :
   1) deriveSlots(doc)  → « créneaux » d'une semaine-type { weekday, label, nature,
                           code, rows } (réutilise l'heuristique de docToSessions,
                           mais conserve les LIGNES pour mapper la bonne colonne).
   2) planDocToSessions(doc, { startDate, weeks, slots }) → lignes `sessions`
                           datées, avec source_week = k (1-based) + source_label. */

import { normalizeProgram, clampWeeks } from "./model.js";
import { codeForNature } from "./materialize.js";
import { parseProgressionCell } from "../oneRM.js";
import { parseISO, isoDate } from "../metrics.js";
import { norm } from "../catalog/detect.js";

// Deux titres se « correspondent » si l'un contient l'autre (normalisés). Sert à
// rattacher un jour de semaine-type « Cardio & Course » à la grille homonyme.
function titlesMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 4 && long.includes(short); // évite qu'un titre trivial (« A ») matche tout
}

/* Ligne d'exercice → exo plat pour la semaine réelle d'indice `col` (0-based).
   Clamp sur la dernière cellule disponible (N réel > semaines du protocole).
   1 LIGNE = 1 EXERCICE : on ne jette JAMAIS la ligne (le nom peut manquer et
   vivre dans le bloc ou la cellule). On conserve la CONSIGNE PRESCRITE brute
   `presc` (avec son unité : reps, kg, watts, kcal, min, distance…), le tempo,
   le repos et la NOTE du coach. Le POURCENTAGE `@xx%` (+ mouvement de référence)
   est préservé → la carte joueur calcule la charge kg depuis son 1RM. */
function rowToExoAtCol(row, col) {
  const cells = Array.isArray(row?.weeks) ? row.weeks : [];
  const idx = cells.length ? Math.min(Math.max(0, col), cells.length - 1) : 0;
  const cell = cells[idx]?.text || cells.map((c) => c?.text).find((x) => x && String(x).trim()) || "";
  const presc = String(cell || "").trim();
  const p = parseProgressionCell(cell);
  const block = String(row?.block || "").trim();
  const name = String(row?.name || "").trim() || block || presc || "Exercice";
  // reps : le nombre parsé s'il y a un vrai sets×reps ; sinon la cellule brute
  // (préserve l'unité non-kg : « 250 watts », « 100 kcal », « 6 min », « 400 m »).
  const reps = p.reps || (p.pct == null && !p.abs ? presc : "");
  const exo = {
    name,
    sets: p.sets || "",
    reps,
    charge: p.abs || "",
    rest: row?.rest ?? 90,
    tempo: String(row?.tempo || "").trim() || null,
    note: String(row?.note || "").trim() || null,
    presc: presc || null, // consigne prescrite fidèle (affichée telle quelle au joueur)
  };
  if (p.pct != null) {
    const ref = String(row?.rmRef || "").trim();
    exo.pct = p.pct;                                   // % du 1RM
    exo.rmLabel = ref || name;                         // mouvement de référence
    exo.rmExerciseId = ref ? null : (row?.exerciseId || null);
  }
  return exo;
}

/* Dérive les créneaux d'une semaine-type depuis le protocole.
   Retourne { slots, warnings }. Chaque slot conserve ses `rows` (pour la
   progression) ; un slot sans rows (jour « libellé seul ») donnera une séance à
   une ligne constante chaque semaine. */
export function deriveSlots(doc) {
  const d = normalizeProgram(doc, doc?.meta?.weeks ?? 4);
  const sections = d.sections || [];
  const exSecs = sections.filter((s) => s.type === "exercises");
  const wcal = sections.find((s) => s.type === "weekcalendar" && Array.isArray(s.days) && s.days.length);
  const warnings = [];

  // Cas 1 — semaine type explicite : chaque jour actif = un créneau.
  if (wcal) {
    const active = wcal.days.filter((day) => !day.off && day.weekday != null);
    const sole = exSecs.length === 1 ? exSecs[0] : null;
    if (exSecs.length > 1) warnings.push("multi-grids");
    const slots = active.map((day) => {
      const nature = day.nature || "";
      const label = day.label || "Séance";
      // 1) Rapprochement par TITRE : un jour « Cardio & Course » ↔ la grille du
      //    même nom (quelle que soit sa nature — le bug perdait ces lignes).
      // 2) Sinon, la grille UNIQUE alimente les jours de force / muscu.
      const byTitle = exSecs.find((s) => titlesMatch(s.title, label));
      const rows = byTitle ? (byTitle.rows || [])
        : (sole && (nature === "force" || /muscu|force|renfo/i.test(label)) ? (sole.rows || []) : []);
      return { weekday: day.weekday, label, nature, code: codeForNature(nature), rows };
    });
    return { slots, warnings };
  }

  // Cas 2 — pas de semaine type : chaque grille d'exercices = un créneau.
  if (exSecs.length) {
    const slots = exSecs.map((s, i) => ({
      weekday: (i % 6) + 1, // lundi..samedi par défaut (l'UI laissera choisir)
      label: s.title || `Séance ${i + 1}`,
      nature: d.meta?.nature || "",
      code: codeForNature(d.meta?.nature || ""),
      rows: s.rows || [],
    }));
    return { slots, warnings };
  }

  // Cas 3 — repli sessionsPerWeek : créneaux neutres.
  const spw = Number(d.meta?.sessionsPerWeek) || 0;
  if (spw > 0) {
    const slots = Array.from({ length: Math.min(spw, 7) }, (_, i) => ({
      weekday: (i % 6) + 1, label: `Séance ${i + 1}`, nature: d.meta?.nature || "",
      code: codeForNature(d.meta?.nature || ""), rows: [],
    }));
    return { slots, warnings };
  }

  warnings.push("no-slots");
  return { slots: [], warnings };
}

/* Génère les lignes `sessions` datées d'une planification.
   `slots` = créneaux résolus (weekday choisi + rows) ; défaut = deriveSlots(doc).
   Pour chaque semaine réelle k (0-based) et chaque créneau : une séance au weekday
   du créneau, exercices dérivés de la colonne Sₖ (clampée à la dernière du
   protocole). Chaque ligne porte source_week (1-based) + source_label. */
export function planDocToSessions(doc, { startDate, weeks, slots } = {}) {
  const cols = clampWeeks(doc?.meta?.weeks ?? 4);       // nb de colonnes S1..Sn du protocole
  const w = clampWeeks(weeks ?? cols);                  // nb de semaines réelles à générer
  const useSlots = Array.isArray(slots) ? slots : deriveSlots(doc).slots;
  const warnings = [];
  if (w > cols) warnings.push("clamp"); // progression clampée sur le dernier bloc

  const base = parseISO(startDate);
  if (!base || isNaN(base.getTime()) || !useSlots.length) return { rows: [], warnings };
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  const rows = [];
  for (const slot of useSlots) {
    const wd = Number(slot.weekday) || 0;
    const delta = (wd - start.getDay() + 7) % 7;
    const first = new Date(start); first.setDate(start.getDate() + delta);
    const nature = slot.nature || "";
    const code = slot.code || codeForNature(nature);
    for (let k = 0; k < w; k++) {
      const d = new Date(first); d.setDate(first.getDate() + 7 * k);
      const col = Math.min(k, cols - 1); // Sₖ clampée
      const exos = (slot.rows || []).map((r) => rowToExoAtCol(r, col)).filter(Boolean);
      rows.push({
        date: isoDate(d),
        code,
        nature: nature || null,
        titre: slot.label || "Séance",
        duration_min: 60,
        exercises: exos.length ? exos : [{ name: slot.label || "Séance", sets: "", reps: "", charge: "", rest: 90 }],
        source_week: k + 1,
        source_label: slot.label || null,
      });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { rows, warnings };
}

/* Lignes générées → payload d'insertion `sessions`, avec le LIEN maintenu vers la
   source (plan_id, program_doc_id, source_week, source_label) et origin='plan'.
   Pur (pas de réseau) → testable. */
export function toSessionRows(genRows, { teamId, planId, programDocId, assigned, overridePlayerId = null } = {}) {
  return (genRows || []).map((r) => ({
    team_id: teamId,
    date: r.date,
    code: r.code || "RS",
    nature: r.nature || null,
    titre: r.titre || "Séance",
    duration_min: r.duration_min || 60,
    exercises: r.exercises || [],
    assigned: assigned || { mode: "all" },
    origin: "plan",
    plan_id: planId,
    program_doc_id: programDocId,
    source_week: r.source_week ?? null,
    source_label: r.source_label ?? null,
    override_player_id: overridePlayerId,
  }));
}
