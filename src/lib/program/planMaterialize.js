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
import { codeForNature, parseScheme } from "./materialize.js";
import { parseISO, isoDate } from "../metrics.js";

// Ligne d'exercice → exo plat pour la semaine réelle d'indice `col` (0-based).
// Clamp sur la dernière cellule disponible (N réel > semaines du protocole).
function rowToExoAtCol(row, col) {
  const name = String(row?.name || "").trim();
  if (!name) return null;
  const cells = Array.isArray(row?.weeks) ? row.weeks : [];
  const idx = cells.length ? Math.min(Math.max(0, col), cells.length - 1) : 0;
  const cell = cells[idx]?.text || cells.map((c) => c?.text).find((x) => x && String(x).trim()) || "";
  const { sets, reps } = parseScheme(cell);
  return {
    name,
    sets: sets || "",
    reps: reps || (cell ? String(cell).trim() : ""),
    charge: String(row?.tempo || "").trim(),
    rest: row?.rest ?? 90,
  };
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
    const soleRows = exSecs.length === 1 ? exSecs[0].rows : [];
    if (exSecs.length > 1) warnings.push("multi-grids");
    const slots = active.map((day) => {
      const nature = day.nature || "";
      const label = day.label || "Séance";
      const useRows = soleRows.length && (nature === "force" || /muscu|force|renfo/i.test(label));
      return { weekday: day.weekday, label, nature, code: codeForNature(nature), rows: useRows ? soleRows : [] };
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
export function toSessionRows(genRows, { teamId, planId, programDocId, assigned } = {}) {
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
  }));
}
