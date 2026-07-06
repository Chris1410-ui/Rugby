/* Postes & groupes — valeurs `grp` alignées sur l'enum SQL player_group
   ('avants' | 'arrieres'). Le prototype utilisait "arrières" (accentué) ;
   on normalise ici vers 'arrieres' pour la base, avec un label d'affichage. */

export const GRP_LABEL = { avants: "Avants", arrieres: "Arrières" };
export const grpLabel = (g) => GRP_LABEL[g] || g;

// [label de poste, grp]
export const RUGBY_POS = [
  ["PILIER G", "avants"],
  ["TALONNEUR", "avants"],
  ["PILIER D", "avants"],
  ["2e LIGNE", "avants"],
  ["2e LIGNE", "avants"],
  ["FLANKER", "avants"],
  ["FLANKER", "avants"],
  ["N°8", "avants"],
  ["DEMI MÊLÉE", "arrieres"],
  ["DEMI OUVERTURE", "arrieres"],
  ["CENTRE", "arrieres"],
  ["CENTRE", "arrieres"],
  ["AILIER", "arrieres"],
  ["AILIER", "arrieres"],
  ["ARRIÈRE", "arrieres"],
];

export const posListFor = (sport) => RUGBY_POS; // football viendra avec le module masqué
