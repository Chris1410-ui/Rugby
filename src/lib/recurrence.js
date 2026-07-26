/* Récurrence transverse — expansion PURE d'une définition en occurrences datées.
   Testable (aucun réseau). Convention weekday ISO : 1=lundi … 7=dimanche.

   value = {
     mode: 'once' | 'recurring',
     date?, time?,                       // mode 'once'
     weekdays: number[],                 // mode 'recurring' (ISO 1..7)
     times: { [weekday]: 'HH:MM' },      // heure par jour
     start, end,                         // 'YYYY-MM-DD'
     exclusions: string[],               // dates ISO à exclure
   }
   → { occurrences: [{date, time}], count, capped, error? } */

import { parseISO, isoDate } from "./metrics.js";

// Garde-fou : nombre maximal d'occurrences générées d'un coup (confirmation UI).
export const MAX_OCCURRENCES = 200;

// JS getDay() : 0=dimanche..6=samedi → ISO 1=lundi..7=dimanche.
export const isoWeekday = (d) => ((d.getDay() + 6) % 7) + 1;

// Ordre d'affichage des pastilles L M M J V S D (ISO 1..7).
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

export function expandRecurrence(value = {}, max = MAX_OCCURRENCES) {
  if (value.mode !== "recurring") {
    if (!value.date) return { occurrences: [], count: 0, capped: false };
    return { occurrences: [{ date: value.date, time: value.time || null }], count: 1, capped: false };
  }

  const weekdays = [...new Set((value.weekdays || []).map(Number))].filter((n) => n >= 1 && n <= 7);
  const start = parseISO(value.start);
  const end = parseISO(value.end);
  if (!weekdays.length || !start || !end || start > end) {
    return { occurrences: [], count: 0, capped: false };
  }
  const excl = new Set(value.exclusions || []);
  const times = value.times || {};

  const occ = [];
  let capped = false;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= stop) {
    const wd = isoWeekday(cur);
    const iso = isoDate(cur);
    if (weekdays.includes(wd) && !excl.has(iso)) {
      if (occ.length >= max) { capped = true; break; }
      occ.push({ date: iso, time: times[wd] || times[String(wd)] || null });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return { occurrences: occ, count: occ.length, capped };
}

/* Régénération d'une série après édition. On ne touche JAMAIS une occurrence
   PROTÉGÉE : passée (date < today), personnalisée (customized) ou déjà réalisée/
   validée par un joueur (hasAttendance). Pur & testable.
   - existing : [{ id, date, customized, hasAttendance }]
   - target   : occurrences voulues [{ date, time }] (expandRecurrence)
   → { toDelete:[ids], toInsert:[{date,time}], toUpdate:[{id,time}] }.
   On ne crée jamais d'occurrence dans le passé ; on ne duplique pas une date
   déjà présente ; on met à jour l'heure des occurrences futures non protégées. */
export function planSeriesUpdate(existing = [], target = [], today) {
  const targetByDate = new Map(target.map((o) => [o.date, o]));
  const existingDates = new Set(existing.map((e) => e.date));
  const isProtected = (e) => e.date < today || e.customized || e.hasAttendance;
  const toDelete = existing.filter((e) => !isProtected(e) && !targetByDate.has(e.date)).map((e) => e.id);
  const toInsert = target.filter((o) => o.date >= today && !existingDates.has(o.date));
  const toUpdate = existing
    .filter((e) => !isProtected(e) && targetByDate.has(e.date))
    .map((e) => ({ id: e.id, time: targetByDate.get(e.date).time }));
  return { toDelete, toInsert, toUpdate };
}

// Libellé récap « Mardi 18h30 et Jeudi 20h » (jours sélectionnés + heures).
export function summarizeDays(value, dayLabels) {
  const weekdays = [...new Set((value.weekdays || []).map(Number))].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b);
  return weekdays
    .map((wd) => {
      const t = (value.times || {})[wd] || (value.times || {})[String(wd)];
      return t ? `${dayLabels[wd]} ${t}` : dayLabels[wd];
    })
    .join(" · ");
}
