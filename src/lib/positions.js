/* Postes & groupes — valeurs `grp` alignées sur l'enum SQL player_group
   ('avants' | 'arrieres'). Chaque poste porte son/ses numéro(s) de maillot,
   son nom complet et sa ligne : le groupe avants/arrières est DÉDUIT du poste
   choisi (jamais saisi séparément). */

import i18n from "../i18n/config.js";

// Libellé de ligne traduit (data.lines.*). Résolu à l'appel → suit la langue.
export const grpLabel = (g) => (g ? i18n.t(`data.lines.${g}`) : "");

// { num, name, grp, key } — ordre = ordre des numéros de maillot. `name` est la
// valeur STOCKÉE en base (players.pos) ET la clé du catalogue (data.pos.*) sert
// à l'affichage traduit. `key` = slug stable pour la traduction.
export const RUGBY_POS = [
  { num: "1", name: "Pilier gauche", grp: "avants", key: "pilierGauche" },
  { num: "2", name: "Talonneur", grp: "avants", key: "talonneur" },
  { num: "3", name: "Pilier droit", grp: "avants", key: "pilierDroit" },
  { num: "4-5", name: "Deuxième ligne", grp: "avants", key: "deuxiemeLigne" },
  { num: "6-7", name: "Troisième ligne aile (flanker)", grp: "avants", key: "troisiemeLigneAile" },
  { num: "8", name: "Troisième ligne centre (n°8)", grp: "avants", key: "troisiemeLigneCentre" },
  { num: "9", name: "Demi de mêlée", grp: "arrieres", key: "demiMelee" },
  { num: "10", name: "Demi d'ouverture", grp: "arrieres", key: "demiOuverture" },
  { num: "11-14", name: "Ailier", grp: "arrieres", key: "ailier" },
  { num: "12-13", name: "Trois-quarts centre", grp: "arrieres", key: "troisQuartCentre" },
  { num: "15", name: "Arrière", grp: "arrieres", key: "arriere" },
];

// Libellé « numéro — nom » (nom FR brut) — usage programmatique/repli.
export const posLabel = (p) => `${p.num} — ${p.name}`;

// Résolution i18n du poste (t = i18next). MAPPING valeur STOCKÉE (nom FR en base)
// → libellé traduit (data.pos.*), SANS jamais changer la valeur stockée. Repli
// sur la valeur brute pour un poste inconnu (import/legacy/personnalisé).
const POS_KEY_BY_NAME = Object.fromEntries(RUGBY_POS.map((p) => [p.name, p.key]));
export const posDisplay = (t, pos) => {
  const key = POS_KEY_BY_NAME[pos];
  return key ? t(`data.pos.${key}`) : (pos || "");
};
// Libellé traduit d'un poste RUGBY_POS (pour le sélecteur) : « num — nom traduit ».
export const posOptionLabel = (t, p) => `${p.num} — ${t(`data.pos.${p.key}`)}`;

// Postes groupés par ligne (avec l'index d'origine pour la sélection). `label`
// est un getter → recalculé dans la langue courante à chaque lecture.
export const POS_GROUPS = ["avants", "arrieres"].map((g) => ({
  grp: g,
  get label() { return grpLabel(g); },
  items: RUGBY_POS.map((p, i) => ({ ...p, i })).filter((p) => p.grp === g),
}));

export const posListFor = () => RUGBY_POS; // football viendra avec le module masqué
