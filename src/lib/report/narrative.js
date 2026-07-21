/* Narratif du rapport de performance : textes à trous PILOTÉS PAR RÈGLES.
   Aucune phrase n'est « inventée » à la volée : chaque bloc est sélectionné à
   partir des drapeaux du view-model (compute.js). Rendu prévisible, cohérent et
   testable — le staff peut relire une fois, la logique s'applique à tous. */

import { escapeHtml } from "./standards.js";

// Libellé court « moteur » selon les points forts terrain.
function fieldTag(flags) {
  if (flags.fieldStrong) return "« explosivité / capacité aérobie »";
  return "« à consolider sur le plan athlétique »";
}

// Phrase d'accroche de la fiche joueur.
function leadLine(model) {
  const poste = model.player.posLabel;
  if (model.flags.fieldStrong && model.flags.strengthDeficit)
    return `${poste} à fort potentiel, moteur athlétique déjà solide et force maximale à construire.`;
  if (model.flags.fieldStrong)
    return `${poste} à fort potentiel, présentant un profil dynamique et engagé.`;
  if (model.flags.strengthDeficit)
    return `${poste} en développement : les fondations de force sont la priorité du prochain bloc.`;
  return `${poste} — profil en cours d'évaluation, données à compléter pour un diagnostic complet.`;
}

// Résumé exécutif : titre + 2 paragraphes.
function summary(model) {
  const { flags } = model;
  let title;
  if (flags.fieldStrong && flags.strengthDeficit) title = "Moteur solide, force en construction";
  else if (flags.fieldStrong) title = "Profil athlétique de terrain confirmé";
  else if (flags.strengthDeficit) title = "Force maximale à développer en priorité";
  else title = "Profil en cours de cartographie";

  const p1 = flags.fieldStrong
    ? `Le joueur présente un profil athlétique typé <span class="hl">${fieldTag(flags)}</span> efficace pour son âge. Les tests de terrain réalisés (Bronco &amp; CMJ) atteignent ou dépassent la borne basse des standards seniors Top 14.`
    : `Le profil athlétique de terrain reste à confirmer : les tests Bronco et CMJ n'atteignent pas encore la borne basse des standards seniors Top 14, ou n'ont pas été mesurés sur cette campagne.`;

  const p2 = flags.strengthDeficit
    ? `À l'inverse, <b>la force maximale haut et bas du corps reste en construction</b>. Le squat et le développé couché sont les priorités absolues de développement pour le prochain bloc de préparation.`
    : `La base de force est cohérente avec les exigences du poste. L'enjeu du prochain bloc sera de <b>compléter les indicateurs manquants</b> et de consolider les acquis.`;

  return { title, paragraphs: [p1, p2] };
}

// Encadrés comparatifs (p5) : point fort (cyan) et déficit (pink).
function comments(model) {
  const positive = model.flags.fieldStrong
    ? {
        title: "⚡ PROFIL EXPLOSIF &amp; ENDURANT",
        body: `Le moteur cardio-pulmonaire et l'extension verticale nécessaires au jeu de mouvement rapide sont présents. C'est un socle athlétique fiable sur lequel appuyer le développement.`,
      }
    : {
        title: "⚡ FONDATIONS À POSER",
        body: `Les qualités de terrain (endurance, détente) doivent être (re)mesurées et développées pour asseoir un profil athlétique complet.`,
      };

  const deficit = model.flags.strengthDeficit
    ? {
        title: "▮▮ DÉFICIT DE FORCE MAXIMALE",
        body: `Les indices de force globale restent sous les exigences. Pour absorber les impacts répétés et performer au contact, l'accent doit se porter sur l'hypertrophie et la force maximale.`,
      }
    : {
        title: "▮▮ INDICATEURS À COMPLÉTER",
        body: `Plusieurs tests de force et de terrain n'ont pas encore été réalisés. Les programmer permettra d'affiner le diagnostic sans angle mort.`,
      };

  return { positive, deficit };
}

// Cartes santé (p7) : psychologique, sommeil, blessures/disponibilité.
function health(model) {
  const wb = model.wellbeing;
  const psych = {
    icon: "🧠",
    accent: model.flags.lowMood || model.flags.highStress ? "a-pink" : "a-cyan",
    title: "PSYCHOLOGIQUE",
    stat: `Morale : ${wb.mood ?? "—"}/10 | Stress : ${wb.stress ?? "—"}/10`,
    body:
      model.flags.lowMood || model.flags.highStress
        ? `Point de vigilance : morale et/ou niveau de stress dégradés. Adapter la charge et maintenir un dialogue rapproché avec le staff avant d'intensifier les blocs physiques.`
        : `Le joueur est psychologiquement disponible, engagé, et présente un niveau de stress maîtrisé. Cette configuration est idéale pour absorber d'importantes charges d'entraînement physique.`,
  };

  const sleep = {
    icon: "🛏",
    accent: model.flags.lowSleep ? "a-pink" : "a-cyan",
    title: "SOMMEIL &amp; RÉCUPÉRATION",
    stat: `Qualité perçue : ${wb.sleep ?? "—"}/10`,
    body: model.flags.lowSleep
      ? `Axe majeur d'amélioration. Un sommeil insuffisant ralentit l'assimilation nerveuse de la force maximale et augmente le risque de fatigue cumulée lors des blocs intensifs.`
      : `Qualité de récupération satisfaisante. À maintenir pour soutenir l'assimilation nerveuse de la force et limiter la fatigue cumulée.`,
  };

  const third = model.flags.hasInjuries
    ? {
        icon: "⚠",
        accent: "a-pink",
        title: "SURVEILLANCE BLESSURES",
        stat: "Antécédents &amp; gênes signalés",
        body: `${escapeHtml(model.player.injuryHistory)} Un feu vert médical et un protocole préventif rigoureux sont requis avant toute hausse importante de charge.`,
      }
    : {
        icon: "✔",
        accent: "a-cyan",
        title: "DISPONIBILITÉ PHYSIQUE",
        stat: "Aucun antécédent signalé",
        body: `Aucune blessure ni gêne signalée à ce jour. Maintenir le travail préventif (mobilité, renforcement du gainage) pour préserver cette disponibilité.`,
      };

  return { psych, sleep, third };
}

// Recommandations (p8) : 4 priorités, sélectionnées et ordonnées par règles.
function priorities(model) {
  const list = [];
  const { flags } = model;

  if (flags.strengthDeficit) {
    list.push({
      icon: "▮▮",
      color: "var(--pink)",
      title: "PRIORITÉ — DÉVELOPPEMENT DE LA FORCE MAXIMALE (6–8 SEMAINES)",
      body: `Consacrer une partie des séances hebdomadaires au travail en tension lourde (squat et développé couché à hautes intensités RM). Maintenir le travail dynamique et pliométrique pour capitaliser sur l'explosivité. Progresser par paliers de charge maîtrisés jusqu'aux cibles Top 14 du poste.`,
    });
  }

  if (flags.hasMissing) {
    list.push({
      icon: "📅",
      color: "var(--cyan)",
      title: "PRIORITÉ — ÉVALUATION DES INDICATEURS MANQUANTS",
      body: `Dès réception du feu vert médical (staff physio/médical), programmer et réaliser les tests non encore mesurés afin de construire un profil mécanique complet, sans angle mort.`,
    });
  }

  if (flags.lowSleep) {
    list.push({
      icon: "🌙",
      color: "var(--cyan)",
      title: "PRIORITÉ — OPTIMISATION DU PROTOCOLE DE RÉCUPÉRATION",
      body: `Mettre en place des routines de sommeil strictes (exposition écran réduite, heures de coucher et lever régulières) pour faire progresser le score subjectif de récupération, soutenant ainsi les gains de force maximale.`,
    });
  }

  if (flags.hasInjuries) {
    list.push({
      icon: "🧰",
      color: "var(--cyan)",
      title: "PRIORITÉ — INDIVIDUALISATION AUTOUR DES GÊNES PHYSIQUES",
      body: `Surveiller de près les zones signalées et utiliser des alternatives adaptées en salle (prises neutres, sangles de tirage, amplitudes ajustées) sans interrompre le cycle d'entraînement global.`,
    });
  }

  if (flags.lowMood || flags.highStress) {
    list.push({
      icon: "🧠",
      color: "var(--pink)",
      title: "PRIORITÉ — ACCOMPAGNEMENT MENTAL & GESTION DE CHARGE",
      body: `Maintenir un suivi rapproché du bien-être (morale, stress) et ajuster la charge en conséquence. Un état mental dégradé compromet l'assimilation de l'entraînement : la régulation prime sur l'intensité.`,
    });
  }

  // Priorité socle si tout va bien : maintien & consolidation.
  if (list.length === 0) {
    list.push({
      icon: "🎯",
      color: "var(--green)",
      title: "PRIORITÉ — CONSOLIDATION & PROGRESSION CONTINUE",
      body: `Le profil ne présente pas de déficit majeur. Maintenir la charge de qualité, viser une progression régulière sur l'ensemble des indicateurs et re-tester à échéance pour confirmer la trajectoire.`,
    });
  }

  // On numérote et on borne à 4 priorités (les plus prioritaires en tête).
  return list.slice(0, 4).map((p, i) => ({ ...p, title: p.title.replace("PRIORITÉ —", `PRIORITÉ ${i + 1} —`) }));
}

export function buildNarrative(model) {
  return {
    lead: leadLine(model),
    summary: summary(model),
    comments: comments(model),
    health: health(model),
    priorities: priorities(model),
  };
}
