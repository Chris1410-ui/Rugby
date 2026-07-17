import { createContext, useContext } from "react";

/* Mode LECTURE SEULE de l'espace staff. Actif pour :
   - le rôle « coach » (accès complet au club mais aucune écriture) ;
   - (à venir) l'owner qui regarde « en tant que » un compte staff.
   Implémenté en contexte pour éviter de faire transiter un prop à travers chaque
   écran. Valeur par défaut `false` → l'espace staff normal (prépa/médical) n'est
   jamais affecté. La sécurité réelle est garantie côté serveur par la RLS
   (`can_write()`) ; ce drapeau ne fait que MASQUER les commandes d'écriture. */
export const ReadOnlyContext = createContext(false);

// true → masque toutes les commandes d'écriture de l'espace staff.
export function useReadOnly() {
  return useContext(ReadOnlyContext);
}
