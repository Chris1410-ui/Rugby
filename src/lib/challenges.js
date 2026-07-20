/* challenges.js — helpers PURS pour les Défis (badges, défi de la semaine).
   La palette de bannières est celle des équipes (crews.js), réutilisée. */
import { grpLabel } from "./positions.js";

export { CREW_BANNERS as CHALLENGE_BANNERS, bannerOf, bannerGradient, randomBannerKey } from "./crews.js";

/* Libellé lisible des destinataires d'un défi (pour la vue détail). Traduit via
   challenges.assigned.* — `t` = fonction i18next. */
export function assignedLabel(t, assigned = { mode: "all" }) {
  switch (assigned?.mode) {
    case "open": return t("challenges.assigned.open");
    case "group": return t("challenges.assigned.group", { line: grpLabel(assigned.group) });
    case "players": return t("challenges.assigned.players", { count: (assigned.ids || []).length });
    default: return t("challenges.assigned.all");
  }
}

// Emojis proposés pour le badge d'un défi (le staff peut aussi taper le sien).
export const CHALLENGE_EMOJIS = ["🏆", "🔥", "⚡", "💪", "🎯", "🚀", "🥇", "⭐", "🦁", "🏉"];

// Paliers de badges gagnés selon le nombre de défis CONFIRMÉS. `key` stable →
// libellé traduit via challengeBadgeLabel (plus de libellé stocké).
export const CHALLENGE_BADGE_TIERS = [
  { n: 1, key: "first", emoji: "🎯" },
  { n: 5, key: "count", emoji: "🥉" },
  { n: 10, key: "count", emoji: "🥈" },
  { n: 25, key: "count", emoji: "🏅" },
];
// Libellé traduit d'un palier de badge (t = i18next). n=1 → « Défi relevé »,
// sinon « {{n}} défis ».
export const challengeBadgeLabel = (t, b) =>
  b.n === 1 ? t("challenges.badge.first") : t("challenges.badge.count", { n: b.n });

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
