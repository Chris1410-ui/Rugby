import { isoDate, parseISO } from "./metrics.js";
import { effectiveNature } from "./nature.js";

/* Anti-surcharge (constructeur de programmes) — helpers PURS et testables.
   Agrègent la charge DÉJÀ prévue d'un périmètre de destinataires par jour et par
   nature, pour signaler l'empilement (ex. deux séances FORCE le même jour).
   Aucune formule compliance/points n'en dépend — pur repère d'équilibrage. */

// Toutes les dates ISO de [startISO, endISO] tombant un weekday donné (0=dim…6=sam).
export function weekdayDatesInRange(startISO, endISO, weekday) {
  const out = [];
  if (!startISO || !endISO) return out;
  const s = parseISO(startISO), e = parseISO(endISO);
  if (!(s <= e)) return out;
  let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const wd = Number(weekday);
  while (cur <= e) {
    if (cur.getDay() === wd) out.push(isoDate(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return out;
}

// Charge existante par date × nature pour les joueurs du périmètre, sur la plage.
// `sessions` = séances enrichies (assignedIds, nature, code, date). `recipientIds`
// = Set d'ids ciblés. Les séances de camp sont comptées (ce sont des sessions
// datées) ; les protocoles ne sont pas datés → hors périmètre.
export function aggregateLoadByDate(sessions, recipientIds, startISO, endISO) {
  const m = {};
  if (!recipientIds || !recipientIds.size || !startISO || !endISO) return m;
  for (const s of sessions || []) {
    if (s.date < startISO || s.date > endISO) continue;
    if (!(s.assignedIds || []).some((id) => recipientIds.has(id))) continue;
    const nat = effectiveNature(s.nature, s.code);
    (m[s.date] = m[s.date] || {});
    m[s.date][nat] = (m[s.date][nat] || 0) + 1;
  }
  return m;
}

// Synthèse d'un jour-modèle : sur ses occurrences (`dates`), combien de MÊME
// nature déjà prévue, combien de jours déjà chargés, et le total par nature.
export function overlapForWeekday(dates, loadByDate, nature) {
  let sameNature = 0, sameNatureDays = 0, busyDays = 0;
  const natTotals = {};
  for (const d of dates || []) {
    const day = loadByDate?.[d];
    if (!day) continue;
    if (Object.values(day).reduce((a, b) => a + b, 0) > 0) busyDays++;
    if (day[nature]) { sameNature += day[nature]; sameNatureDays++; }
    for (const [k, v] of Object.entries(day)) natTotals[k] = (natTotals[k] || 0) + v;
  }
  return { sameNature, sameNatureDays, busyDays, natTotals };
}
