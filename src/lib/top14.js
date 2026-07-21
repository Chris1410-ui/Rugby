/* top14.js — point d'entrée FRONT-END du référentiel Top 14.

   Ré-exporte tout le NOYAU (top14.core.js, sans i18n) et ajoute le seul élément
   dépendant d'i18n : catLabel (libellé traduit de catégorie de poste). Les
   modules exécutés côté serveur (fonction Vercel du rapport PDF) importent
   directement top14.core.js pour ne PAS charger i18n/config.js (imports JSON de
   locale interdits par l'ESM natif de Node sans attribut « with { type: json } »). */

import i18n from "../i18n/config.js";
import { TOP14_BENCH } from "./top14.core.js";

export * from "./top14.core.js";

// Libellé traduit d'une catégorie de poste (data.top14cat.*). Résolu à l'appel.
export const catLabel = (cat) => (TOP14_BENCH[cat] ? i18n.t(`data.top14cat.${cat}`) : "—");
