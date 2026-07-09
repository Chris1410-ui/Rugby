/* ════════════════════════════════════════════════════════════════
   Politique de confidentialité — contenu & version.

   `POLICY_VERSION` est enregistrée avec chaque consentement : si la
   politique évolue de façon substantielle, incrémente-la pour pouvoir
   redemander l'accord (le consentement archivé garde la version acceptée).

   Données de santé de mineurs (U18) → hébergement UE (Francfort) et
   consentement du représentant légal requis (RGPD art. 8 & 9).
   ════════════════════════════════════════════════════════════════ */

export const POLICY_VERSION = "2026-01";

// Responsable de traitement — à adapter avant mise en production réelle.
export const CONTROLLER = {
  name: "Fédération / club (responsable de traitement)",
  contact: "dpo@club.example",
};

export const POLICY = {
  version: POLICY_VERSION,
  updated: "Janvier 2026",
  intro:
    "Cette plateforme suit la performance et la santé de joueurs de rugby mineurs (U18). " +
    "Les données sont hébergées dans l'Union européenne (Francfort) et traitées conformément au RGPD.",
  sections: [
    {
      title: "Données collectées",
      body:
        "Identité (nom, poste, numéro), bilans quotidiens de bien-être (fatigue, sommeil, " +
        "courbatures…), charges d'entraînement et validations de séances, messages avec le staff, " +
        "tests physiques. Ces données incluent des données de santé.",
    },
    {
      title: "Finalités",
      body:
        "Suivi de la charge et prévention des blessures, individualisation de l'entraînement, " +
        "communication encadrant ↔ joueur. Aucune décision entièrement automatisée : les alertes " +
        "sont des aides à la décision du staff.",
    },
    {
      title: "Base légale & consentement parental",
      body:
        "Le traitement des données de santé d'un mineur repose sur le consentement explicite du " +
        "représentant légal, recueilli à l'inscription et révocable à tout moment.",
    },
    {
      title: "Accès & destinataires",
      body:
        "Seuls le joueur (ses propres données) et le staff de son équipe (préparateur, médical, " +
        "coach) y accèdent. Le cloisonnement est appliqué au niveau de la base (Row Level Security). " +
        "Aucune revente ni transfert hors UE.",
    },
    {
      title: "Conservation",
      body:
        "Les données sont conservées le temps de la présence du joueur dans l'effectif, puis " +
        "supprimées ou anonymisées. Le responsable peut fixer une durée plus courte.",
    },
    {
      title: "Vos droits",
      body:
        "Accès, rectification, portabilité (export de vos données) et effacement. L'export et la " +
        "suppression sont disponibles directement dans l'application (écran « Mes données »). " +
        "Le retrait du consentement entraîne l'effacement des données du joueur.",
    },
  ],
};
