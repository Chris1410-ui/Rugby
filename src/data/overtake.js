import { useEffect, useRef, useState } from "react";

/* Détection « on t'a repassé » — 100 % client, en direct. Le classement du club
   (useClubLeaderboard) est déjà rafraîchi par Realtime sur les tables sources ;
   on compare l'ordre AVANT/APRÈS : un coéquipier qui était DERRIÈRE moi et passe
   DEVANT = dépassement. Aucune table, aucun journal parallèle, aucune donnée de
   santé — on lit la liste [{id, pts}] triée fournie par le barème existant.

   `list` = classement trié (pts ↓), `meId` = joueur connecté. Renvoie le dernier
   dépassement { id, gap, key } (key monotone → l'UI n'alerte qu'une fois). */
export function useOvertakeWatch(meId, list) {
  const prev = useRef(null);
  const seq = useRef(0);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!meId || !Array.isArray(list) || !list.length) return;
    const order = list.map((r) => r.id);
    const pts = Object.fromEntries(list.map((r) => [r.id, r.pts]));
    const p = prev.current;
    prev.current = { order, pts };
    if (!p) return; // premier instantané → référence, pas d'alerte

    const myNew = order.indexOf(meId);
    const myOld = p.order.indexOf(meId);
    if (myNew < 0 || myOld < 0) return;

    // Devant moi maintenant ET derrière moi avant = m'a dépassé.
    const overtakers = order.slice(0, myNew).filter((id) => {
      const old = p.order.indexOf(id);
      return old > myOld; // était derrière (ou absent → old = -1 exclu)
    });
    if (!overtakers.length) return;

    // Le plus proche au-dessus (plus petit écart).
    const gapOf = (id) => (pts[id] || 0) - (pts[meId] || 0);
    overtakers.sort((a, b) => gapOf(a) - gapOf(b));
    const who = overtakers[0];
    seq.current += 1;
    setEvent({ id: who, gap: Math.max(0, gapOf(who)), key: seq.current });
  }, [list, meId]);

  return { event, dismiss: () => setEvent(null) };
}
