/* ════════════════════════════════════════════════════════════════
   Design tokens — palette & theme (haute fidélité au prototype)
   Source: RugbyApp.jsx §palette + PROMPT.md §Palette & design system.
   ════════════════════════════════════════════════════════════════ */

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
  rugby: [{ id: "r_u18", label: "Belgique U18", short: "U18", comp: "Championnat Régions U18" }],
  foot: [
    { id: "f_u19", label: "Diables Rouges U19", short: "U19", comp: "Élite Jeunes U19" },
    { id: "f_pro", label: "Académie Pro", short: "Acad.", comp: "Réserve Pro League" },
  ],
};

// Rôles = vues
export const ROLES = [
  { id: "preparateur", l: "Préparateur physique", s: "Staff complet · charge · séances", e: "⚡", c: C.coral },
  { id: "joueur", l: "Joueur", s: "Mon espace · bilan · feedback", e: "🏉", c: C.green },
  { id: "medical", l: "Médical", s: "Kiné / réathlé · disponibilité", e: "🩺", c: C.teal },
];

export const STAFF_ROLES = ["preparateur", "medical", "coach"];
export const isStaffRole = (r) => STAFF_ROLES.includes(r);

// Codes de séance (couleur de pastille)
export const CODES = {
  RS: C.coral,   // Renforcement / force
  CDD: C.blue,   // Conditioning demi-distance
  CSB: C.teal,   // Conditioning spécifique
  CASB: C.green,
  AC: C.viol,    // Accélérations
  BLI: C.gray,   // Blessé / individualisé
};
