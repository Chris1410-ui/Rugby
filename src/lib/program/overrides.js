/* Résolution SOCLE → SURCHARGE d'un protocole personnalisé « au nom d'un joueur ».
   Pur & testable (aucun réseau). Le socle est le program_docs collectif ; les
   surcharges (protocol_player_overrides) sont appliquées PAR-DESSUS — la surcharge
   l'emporte toujours (préséance). On renvoie aussi l'ensemble des chemins
   personnalisés (badges « modifié pour ce joueur ») et les surcharges ORPHELINES
   (la cible n'existe plus au socle → à nettoyer). Les surcharges `slot/<label>`
   (jour d'un créneau) ne touchent pas le doc : elles sont renvoyées à part pour
   être appliquées aux créneaux à la génération (applySlotOverrides). */

import { normalizeProgram } from "./model.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

/* Décode un `path` canonique. Formes reconnues :
   sec/<id> · sec/<id>/row/<rid> · sec/<id>/add · add/section · slot/<label…> */
export function parsePath(path) {
  const parts = String(path || "").split("/");
  if (parts[0] === "sec" && parts[2] === "row" && parts[3]) return { kind: "row", sectionId: parts[1], rowId: parts[3] };
  if (parts[0] === "sec" && parts[2] === "add") return { kind: "addRow", sectionId: parts[1] };
  if (parts[0] === "sec" && parts[1]) return { kind: "section", sectionId: parts[1] };
  if (parts[0] === "add" && parts[1] === "section") return { kind: "addSection" };
  if (parts[0] === "slot" && parts[1] != null && parts[1] !== "") return { kind: "slot", slotKey: parts.slice(1).join("/") };
  return { kind: "unknown" };
}

// Fusionne une ligne avec un patch. `weeks` est fusionné CELLULE PAR CELLULE (par
// index) : surcharger la semaine 2 ne réécrit pas les autres colonnes.
function mergeRow(row, value) {
  const next = { ...row };
  for (const [k, v] of Object.entries(value || {})) {
    if (k === "weeks" && v && typeof v === "object") {
      const cells = Array.isArray(next.weeks) ? next.weeks.map((c) => ({ ...c })) : [];
      for (const [idx, cell] of Object.entries(v)) {
        const i = Number(idx);
        if (!Number.isInteger(i) || i < 0) continue;
        cells[i] = { text: "", peak: false, ...(cells[i] || {}), ...(cell || {}) };
      }
      next.weeks = cells;
    } else next[k] = v;
  }
  return next;
}

// Ordre déterministe d'application (les removes d'abord, les adds ensuite).
const ORDER = { section: 0, row: 1, addRow: 2, addSection: 2, slot: 3, unknown: 9 };

export function resolvePlayerDoc(socleDoc, overrides = []) {
  const doc = clone(normalizeProgram(socleDoc, socleDoc?.meta?.weeks));
  const overriddenPaths = new Set();
  const orphans = [];
  const slotOverrides = {}; // { [sourceLabel]: { weekday } }

  const sorted = [...(overrides || [])].sort((a, b) => (ORDER[parsePath(a.path).kind] ?? 9) - (ORDER[parsePath(b.path).kind] ?? 9));

  for (const ov of sorted) {
    const p = parsePath(ov.path);
    if (p.kind === "section") {
      const idx = doc.sections.findIndex((s) => s.id === p.sectionId);
      if (idx < 0) { orphans.push(ov.path); continue; }
      if (ov.op === "remove") doc.sections.splice(idx, 1);
      else doc.sections[idx] = { ...doc.sections[idx], ...(ov.value || {}) };
      overriddenPaths.add(ov.path);
    } else if (p.kind === "row") {
      const sec = doc.sections.find((s) => s.id === p.sectionId);
      const rows = sec && Array.isArray(sec.rows) ? sec.rows : null;
      const ri = rows ? rows.findIndex((r) => r.id === p.rowId) : -1;
      if (ri < 0) { orphans.push(ov.path); continue; }
      if (ov.op === "remove") rows.splice(ri, 1);
      else rows[ri] = mergeRow(rows[ri], ov.value);
      overriddenPaths.add(ov.path);
    } else if (p.kind === "addRow") {
      const sec = doc.sections.find((s) => s.id === p.sectionId);
      if (!sec) { orphans.push(ov.path); continue; }
      if (!Array.isArray(sec.rows)) sec.rows = [];
      sec.rows.push(clone(ov.value || {}));
      overriddenPaths.add(ov.path);
    } else if (p.kind === "addSection") {
      doc.sections.push(clone(ov.value || {}));
      overriddenPaths.add(ov.path);
    } else if (p.kind === "slot") {
      if (ov.value && ov.value.weekday != null) slotOverrides[p.slotKey] = { weekday: Number(ov.value.weekday) };
      overriddenPaths.add(ov.path);
    } else {
      orphans.push(ov.path);
    }
  }
  return { doc, overriddenPaths, orphans, slotOverrides };
}

// Applique les surcharges de jour (slot/<label>) à des créneaux résolus.
export function applySlotOverrides(slots, slotOverrides = {}) {
  return (slots || []).map((s) => {
    const ov = slotOverrides[s.label];
    return ov && ov.weekday != null ? { ...s, weekday: ov.weekday } : s;
  });
}

/* Détecte les conflits socle↔surcharge lors d'une édition du socle (PR-4) : une
   surcharge de type 'patch'/'remove' entre en conflit si la valeur du socle AU
   MÊME chemin a changé entre l'ancien et le nouveau doc. Pur & testable. */
export function overrideConflicts(oldDoc, newDoc, overrides = []) {
  const findRow = (d, sid, rid) => {
    const s = (d?.sections || []).find((x) => x.id === sid);
    return s && Array.isArray(s.rows) ? s.rows.find((r) => r.id === rid) : null;
  };
  const findSec = (d, sid) => (d?.sections || []).find((x) => x.id === sid) || null;
  const out = [];
  for (const ov of overrides || []) {
    const p = parsePath(ov.path);
    if (p.kind === "row") {
      const a = findRow(oldDoc, p.sectionId, p.rowId), b = findRow(newDoc, p.sectionId, p.rowId);
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: ov.path, playerId: ov.playerId });
    } else if (p.kind === "section") {
      const a = findSec(oldDoc, p.sectionId), b = findSec(newDoc, p.sectionId);
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: ov.path, playerId: ov.playerId });
    }
  }
  return out;
}
