/* Postes & groupes — valeurs `grp` alignées sur l'enum SQL player_group
   ('avants' | 'arrieres'). Chaque poste porte son/ses numéro(s) de maillot,
   son nom complet et sa ligne : le groupe avants/arrières est DÉDUIT du poste
   choisi (jamais saisi séparément). */

import i18n from "../i18n/config.js";

// Libellé de ligne traduit (data.lines.*). Résolu à l'appel → suit la langue.
export const grpLabel = (g) => (g ? i18n.t(`data.lines.${g}`) : "");

// { num, name, grp } — ordre = ordre des numéros de maillot.
export const RUGBY_POS = [
  { num: "1", name: "Pilier gauche", grp: "avants" },
  { num: "2", name: "Talonneur", grp: "avants" },
  { num: "3", name: "Pilier droit", grp: "avants" },
  { num: "4-5", name: "Deuxième ligne", grp: "avants" },
  { num: "6-7", name: "Troisième ligne aile (flanker)", grp: "avants" },
  { num: "8", name: "Troisième ligne centre (n°8)", grp: "avants" },
  { num: "9", name: "Demi de mêlée", grp: "arrieres" },
  { num: "10", name: "Demi d'ouverture", grp: "arrieres" },
  { num: "11-14", name: "Ailier", grp: "arrieres" },
  { num: "12-13", name: "Trois-quarts centre", grp: "arrieres" },
  { num: "15", name: "Arrière", grp: "arrieres" },
];

// Libellé « numéro — nom » pour les listes déroulantes.
export const posLabel = (p) => `${p.num} — ${p.name}`;

// Postes groupés par ligne (avec l'index d'origine pour la sélection). `label`
// est un getter → recalculé dans la langue courante à chaque lecture.
export const POS_GROUPS = ["avants", "arrieres"].map((g) => ({
  grp: g,
  get label() { return grpLabel(g); },
  items: RUGBY_POS.map((p, i) => ({ ...p, i })).filter((p) => p.grp === g),
}));

export const posListFor = () => RUGBY_POS; // football viendra avec le module masqué
