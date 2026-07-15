/* ════════════════════════════════════════════════════════════════
   crews.js — bannières prédéfinies des équipes de joueurs (crews).

   À la création d'un crew, une bannière est tirée au hasard dans ce jeu
   (motif + dégradé de couleurs de la charte). Purement visuel : la clé est
   stockée en base (crews.banner), le rendu vit ici.
   ════════════════════════════════════════════════════════════════ */

export const CREW_BANNERS = [
  { key: "flame",  label: "Flamme",  c1: "#E8553B", c2: "#C9851F", emoji: "🔥" },
  { key: "storm",  label: "Orage",   c1: "#3E4CA8", c2: "#6C5CE0", emoji: "⚡" },
  { key: "wave",   label: "Vague",   c1: "#1C7293", c2: "#27E8D6", emoji: "🌊" },
  { key: "forest", label: "Forêt",   c1: "#2C8C5A", c2: "#1C7293", emoji: "🌲" },
  { key: "sun",    label: "Soleil",  c1: "#C9851F", c2: "#F2C84B", emoji: "☀️" },
  { key: "night",  label: "Nuit",    c1: "#2A2350", c2: "#6C5CE0", emoji: "🌙" },
  { key: "rock",   label: "Roc",     c1: "#5A5870", c2: "#3E4CA8", emoji: "🪨" },
  { key: "venom",  label: "Venin",   c1: "#6C5CE0", c2: "#2C8C5A", emoji: "🐍" },
  { key: "bolt",   label: "Éclair",  c1: "#C9851F", c2: "#E8553B", emoji: "⚡" },
  { key: "shark",  label: "Requin",  c1: "#1C7293", c2: "#3E4CA8", emoji: "🦈" },
];

export const bannerOf = (key) =>
  CREW_BANNERS.find((b) => b.key === key) || CREW_BANNERS[0];

// CSS du dégradé d'une bannière (réutilisé page équipe + classement).
export const bannerGradient = (key) => {
  const b = bannerOf(key);
  return `linear-gradient(135deg, ${b.c1}, ${b.c2})`;
};

// Tirage aléatoire à la création (navigateur — Math.random OK à l'exécution).
export const randomBannerKey = () =>
  CREW_BANNERS[Math.floor(Math.random() * CREW_BANNERS.length)].key;
