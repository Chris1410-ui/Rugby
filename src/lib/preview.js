import { createContext, useContext } from "react";

/* Mode « aperçu joueur » (owner / staff). Quand actif, l'espace joueur est rendu
   en LECTURE SEULE : aucune écriture ne part sous l'identité du joueur observé
   (bilan, séance, message, crew, RGPD). Implémenté en contexte pour éviter de
   faire transiter un prop à travers chaque écran intermédiaire — la valeur par
   défaut est `false`, donc le rendu normal du joueur (et les fils staff hors
   PlayerApp) n'est jamais affecté. PlayerApp fournit le contexte via
   <PreviewContext.Provider value={preview}>. */
export const PreviewContext = createContext(false);

// true → espace joueur en lecture seule (aperçu owner/staff)
export function usePreview() {
  return useContext(PreviewContext);
}
