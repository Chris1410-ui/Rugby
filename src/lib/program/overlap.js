/* Règle de NON-SUPERPOSITION entre PROTOCOLES (program_docs) sur un même joueur.
   Deux protocoles ne doivent JAMAIS couvrir le même joueur sur des périodes qui se
   chevauchent (sinon : jours en double + surcharge invisible). En revanche, un
   PROGRAMME et un protocole (ou deux programmes) PEUVENT se superposer — ça relève
   du simple avertissement anti-surcharge, jamais du blocage. Ces helpers sont PURS
   (aucun réseau) et testables. */

import { resolveAssignedIds } from "../../data/sessions.js";

// Deux intervalles de dates ISO (YYYY-MM-DD, comparables lexicographiquement) se
// chevauchent-ils ? Bornes incluses.
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/* Détecte les conflits protocole↔protocole pour un NOUVEAU plan.
   - start/end : période (ISO) du nouveau plan ;
   - targetIds : ids des joueurs visés par le nouveau plan ;
   - existing  : séances des AUTRES protocoles de l'équipe, forme
                 [{ docId, date, ids:[joueurs couverts] }] (le candidat est exclu) ;
   - docTitles : { [docId]: titre } pour le message.
   Retourne un conflit par (joueur, protocole) dont l'étendue réelle (min→max des
   séances couvrant ce joueur) chevauche [start,end] :
   [{ playerId, docId, docTitle, from, to }]. */
export function computeProtocolConflicts({ start, end, targetIds, existing, docTitles = {} }) {
  const targ = new Set(targetIds || []);
  const acc = new Map(); // `${pid}|${docId}` → { playerId, docId, min, max }
  for (const s of existing || []) {
    if (!s.docId || !s.date) continue;
    for (const pid of s.ids || []) {
      if (!targ.has(pid)) continue;
      const key = `${pid}|${s.docId}`;
      const cur = acc.get(key);
      if (!cur) acc.set(key, { playerId: pid, docId: s.docId, min: s.date, max: s.date });
      else {
        if (s.date < cur.min) cur.min = s.date;
        if (s.date > cur.max) cur.max = s.date;
      }
    }
  }
  const list = [];
  for (const c of acc.values()) {
    if (rangesOverlap(start, end, c.min, c.max)) {
      list.push({ playerId: c.playerId, docId: c.docId, docTitle: docTitles[c.docId] || "", from: c.min, to: c.max });
    }
  }
  return list;
}

/* Retire UN joueur d'un `assigned` en préservant les autres destinataires. On
   résout d'abord la liste réelle (une ligne peut couvrir le joueur), puis on
   reconstruit une liste EXPLICITE sans lui. Vide → {mode:'none'} (l'appelant
   refuse alors la publication / supprime la ligne). */
export function removePlayerFromAssigned(assigned, playerId, roster) {
  const ids = resolveAssignedIds(assigned, roster).filter((id) => id !== playerId);
  if (!ids.length) return { mode: "none" };
  return { mode: "mix", groups: [], ids };
}
