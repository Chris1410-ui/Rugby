/* Ordre de passage — logique pure (rang joueur, prochains à passer). Aucune
   dépendance réseau : testable. Un ticket = { id, playerId, position, progress
   (0|50|100), absent }. L'ordre officiel = position croissante puis joinedAt. */

export function orderTickets(tickets = []) {
  return [...tickets].sort(
    (a, b) => (a.position - b.position) || String(a.joinedAt ?? "").localeCompare(String(b.joinedAt ?? "")),
  );
}

// Un ticket « en attente » = ni absent ni terminé (il reste à passer).
const pending = (t) => !t.absent && (t.progress ?? 0) < 100;

/* Statut d'un joueur dans la file : rang (place parmi les tickets en attente qui
   le précèdent + 1), nombre de joueurs devant, avancement, et si c'est son tour.
   Renvoie { inQueue:false } s'il n'a pas de ticket. */
export function playerQueueStatus(tickets, playerId) {
  const order = orderTickets(tickets);
  const mine = order.find((t) => t.playerId === playerId) || null;
  if (!mine) return { inQueue: false };
  if (mine.absent) return { inQueue: true, absent: true, progress: mine.progress ?? 0 };
  if ((mine.progress ?? 0) >= 100) return { inQueue: true, done: true, progress: 100 };

  let ahead = 0;
  for (const t of order) {
    if (t.id === mine.id) break;
    if (pending(t)) ahead += 1;
  }
  return { inQueue: true, rank: ahead + 1, ahead, progress: mine.progress ?? 0, isTurn: ahead === 0 };
}

// Player ids des N prochains à passer (en attente, dans l'ordre). Sert au staff
// (« prépare-toi » côté serveur, ici pour un éventuel surlignage).
export function nextUpIds(tickets, n = 2) {
  return orderTickets(tickets).filter(pending).slice(0, n).map((t) => t.playerId);
}

// Cycle d'avancement en un geste : 0 → 50 → 100 → 0.
export function nextProgress(p) {
  return p >= 100 ? 0 : p >= 50 ? 100 : 50;
}
