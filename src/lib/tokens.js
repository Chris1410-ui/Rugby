/* ════════════════════════════════════════════════════════════════
   Design tokens — palette & theme (haute fidélité au prototype)
   Source: RugbyApp.jsx §palette + PROMPT.md §Palette & design system.
   ════════════════════════════════════════════════════════════════ */

import i18n from "../i18n/config.js";

export const C = {
  navy: "#16142E",
  panel: "#1E1B3A",
  coral: "#E8553B",   // préparateur / alertes
  blue: "#3E4CA8",    // coach
  viol: "#6C5CE0",
  teal: "#1C7293",    // sous-charge
  green: "#2C8C5A",   // joueur / OK / cible
  amb: "#C9851F",     // vigilance
  gray: "#8A88A0",
  card: "rgba(255,255,255,0.055)",
  card2: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.1)",
  border2: "rgba(255,255,255,0.06)",
};

// Accent néon (écran classement)
export const NEON = {
  cyan: "#27E8D6",
  yellow: "#F2C84B",
  panel: "#181433",
  row: "rgba(255,255,255,0.035)",
  rowB: "rgba(108,92,224,0.14)",
};

export const FONT =
  "-apple-system,BlinkMacSystemFont,Inter,Segoe UI,Roboto,Arial,sans-serif";

// Carte utilitaire (style objet inline, comme le prototype `sc`)
export const sc = (e = {}) => ({
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 14,
  ...e,
});

// Sports & équipes (le module football reste masqué derrière un flag)
export const SPORTS = {
  rugby: { key: "rugby", label: "Rugby", emoji: "🏉", accent: C.green, accent2: C.amb },
  foot: { key: "foot", label: "Football", emoji: "⚽", accent: "#E8C53B", accent2: "#2D6CDF" },
};

export const TEAMS = {
  rugby: [
    { id: "r_u18", label: "Belgique U18", short: "U18", comp: "Championnat Régions U18" },
    { id: "r_namur", label: "Namur", short: "NAM", comp: "Championnat Régions U18" },
  ],
  foot: [
    { id: "f_u19", label: "Diables Rouges U19", short: "U19", comp: "Élite Jeunes U19" },
    { id: "f_pro", label: "Académie Pro", short: "Acad.", comp: "Réserve Pro League" },
  ],
};

// Rôles = vues. Les libellés `l`/`s` sont des getters (data.roles.*) → traduits
// dans la langue courante à chaque lecture, sans figer la valeur au chargement.
const roleView = (id, e, c) => ({
  id, e, c,
  get l() { return i18n.t(`data.roles.${id}.l`); },
  get s() { return i18n.t(`data.roles.${id}.s`); },
});
export const ROLES = [
  roleView("preparateur", "⚡", C.coral),
  roleView("joueur", "🏉", C.green),
  roleView("medical", "🩺", C.teal),
  roleView("coach", "📋", C.blue),
];

export const STAFF_ROLES = ["preparateur", "medical", "coach"];
export const isStaffRole = (r) => STAFF_ROLES.includes(r);

/* Rôles autorisés à ÉCRIRE (création / édition / validation / envoi). Le coach
   est staff (accès lecture à tout le club) mais SANS écriture — miroir exact de
   la RLS serveur `can_write()` = preparateur/medical. */
export const CAN_WRITE_ROLES = ["preparateur", "medical"];
export const canWrite = (r) => CAN_WRITE_ROLES.includes(r);

/* Un profil est « complet » s'il possède les champs REQUIS pour son rôle.
   Sert de garde-fou UI : un compte authentifié mais à moitié provisionné
   (rôle sans team_id, joueur sans player_id…) doit afficher un écran clair
   « profil incomplet » plutôt que de charger à l'infini.
   - owner  : voit tous les clubs → team_id/player_id null OK
   - joueur : rattaché à un club ET à une fiche joueur → team_id + player_id
   - staff  : rattaché à un club → team_id
   - rôle inconnu / absent : incomplet */
export function isProfileComplete(profile) {
  if (!profile || !profile.role) return false;
  if (profile.role === "owner") return true;
  if (profile.role === "joueur") return Boolean(profile.team_id && profile.player_id);
  if (isStaffRole(profile.role)) return Boolean(profile.team_id);
  return false; // rôle non reconnu → à corriger côté staff
}

/* Codes de séance (couleur de pastille). Le CODE reste la valeur stockée ; son
   libellé d'affichage est traduit via data.sessionCode.* (sessionCodeLabel).
   « CDD » est l'ANCIEN code de « COD » (Changement de Direction) : conservé ici
   comme alias couleur pour que les séances déjà enregistrées restent lisibles,
   sans le proposer à la saisie. */
export const CODES = {
  RS: C.coral,    // Renforcement en Salle
  COD: C.blue,    // Changement de Direction
  CSB: C.teal,    // Course Sans Ballon
  CASB: C.green,  // Course Avec Ballon
  AC: C.viol,     // Activité Combattue
  BLI: C.gray,    // Bloc Liaison Intermédiaire
  CDD: C.blue,    // legacy → COD (séances antérieures)
};

// Codes proposés à la saisie (COD canonique ; CDD legacy exclu du sélecteur).
export const SESSION_CODES = ["RS", "COD", "CSB", "CASB", "AC", "BLI"];

// Ancien code → code canonique (pour retrouver le bon libellé traduit).
const CODE_CANON = { CDD: "COD" };

// Libellé d'affichage traduit d'un code de séance (t = i18next). Repli sur le
// code brut si aucune traduction (code personnalisé).
export const sessionCodeLabel = (t, code) =>
  t(`data.sessionCode.${CODE_CANON[code] || code}`, { defaultValue: code || "" });
