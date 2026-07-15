/* ════════════════════════════════════════════════════════════════
   youtube.js — helpers liens vidéo (transmission de programmes #1).

   Un exercice peut porter un champ `video` (URL). On accepte les formes
   YouTube courantes (watch, youtu.be, shorts, embed) et on en extrait
   l'ID pour proposer un lecteur intégré ; sinon on retombe sur le lien
   cliquable brut. Pur / testable — aucune dépendance réseau.
   ════════════════════════════════════════════════════════════════ */

// Extrait l'ID vidéo (11 caractères) d'une URL YouTube, sinon null.
export function youtubeId(url) {
  if (!url || typeof url !== "string") return null;
  const s = url.trim();
  // youtu.be/<id>, /shorts/<id>, /embed/<id>, /watch?v=<id>, /v/<id>
  const m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/))([A-Za-z0-9_-]{11})/
  );
  if (m) return m[1];
  // ID nu collé tel quel
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

// URL d'intégration (iframe) si c'est une vidéo YouTube reconnue, sinon null.
export function youtubeEmbed(url) {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

// URL sûre à ouvrir dans un onglet : http(s) uniquement (évite javascript:, etc.).
export function safeVideoUrl(url) {
  if (!url || typeof url !== "string") return null;
  const s = url.trim();
  if (youtubeId(s) && !/^https?:\/\//i.test(s)) return `https://www.youtube.com/watch?v=${youtubeId(s)}`;
  return /^https?:\/\//i.test(s) ? s : null;
}

// Vrai si l'URL est exploitable (embed YouTube OU lien http(s) cliquable).
export const hasVideo = (url) => !!safeVideoUrl(url);
