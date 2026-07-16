import { useEffect, useState } from "react";
import { todayISO } from "./metrics.js";

/* Date locale « YYYY-MM-DD » de l'appareil, qui BASCULE AUTOMATIQUEMENT à
   minuit heure locale : un minuteur programmé sur le prochain 00:00 met à jour
   l'état → re-rendu → la vue « du jour » se réinitialise sans rien effacer en
   base. Rien n'est modifié côté données : simple recalcul de la date locale. */
export function useLocalToday() {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    let timer;
    const schedule = () => {
      const now = new Date();
      // Prochain minuit local (+2 s de marge pour être sûr d'avoir changé de jour).
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2, 0);
      timer = setTimeout(() => { setToday(todayISO()); schedule(); }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    };
    schedule();
    // Re-vérifie aussi au retour de veille / focus (l'onglet a pu dormir).
    const onFocus = () => setToday(todayISO());
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { clearTimeout(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);
  return today;
}
