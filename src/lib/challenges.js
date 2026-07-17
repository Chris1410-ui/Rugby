/* challenges.js — helpers PURS pour les Défis (badges, défi de la semaine).
   La palette de bannières est celle des équipes (crews.js), réutilisée. */

export { CREW_BANNERS as CHALLENGE_BANNERS, bannerOf, bannerGradient, randomBannerKey } from "./crews.js";

// Emojis proposés pour le badge d'un défi (le staff peut aussi taper le sien).
export const CHALLENGE_EMOJIS = ["🏆", "🔥", "⚡", "💪", "🎯", "🚀", "🥇", "⭐", "🦁", "🏉"];

// Paliers de badges gagnés selon le nombre de défis CONFIRMÉS.
export const CHALLENGE_BADGE_TIERS = [
  { n: 1, label: "Défi relevé", emoji: "🎯" },
  { n: 5, label: "5 défis", emoji: "🥉" },
  { n: 10, label: "10 défis", emoji: "🥈" },
  { n: 25, label: "25 défis", emoji: "🏅" },
];

// Badges obtenus pour un nombre de défis confirmés (du plus haut au plus bas).
export function challengeBadges(confirmedCount = 0) {
  return CHALLENGE_BADGE_TIERS.filter((t) => confirmedCount >= t.n);
}

// Plus haut palier atteint (pour un affichage compact), sinon null.
export function topChallengeBadge(confirmedCount = 0) {
  const won = challengeBadges(confirmedCount);
  return won.length ? won[won.length - 1] : null;
}

/* « 🔥 Défi de la semaine » : le défi ACTIF (échéance non dépassée) le plus
   récent. `challenges` supposé trié du plus récent au plus ancien. */
export function defiOfWeek(challenges = [], today) {
  const active = challenges.filter((c) => !c.echeance || !today || c.echeance >= today);
  return active[0] || challenges[0] || null;
}
