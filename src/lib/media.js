/* media.js — helpers Médiathèque (plateforme, vignette, embed). PUR / testable,
   aucune dépendance réseau. Réutilise youtube.js pour l'extraction d'ID. */

import { youtubeId, youtubeEmbed, safeVideoUrl } from "./youtube.js";

// Thèmes suggérés par défaut (le champ reste en texte libre → éditable).
export const MEDIA_THEMES = ["Technique", "Prévention", "Muscu", "Nutrition", "Mental"];

// Détecte la plateforme d'une URL : youtube | instagram | autre.
export function detectPlatform(url) {
  if (youtubeId(url)) return "youtube";
  if (/instagram\.com/i.test(String(url || ""))) return "instagram";
  return "autre";
}

// Code d'un post / reel / tv Instagram (pour l'embed), sinon null.
export function instagramCode(url) {
  const m = String(url || "").match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

// URL d'embed Instagram (best-effort ; l'iframe peut échouer selon le post).
export function instagramEmbed(url) {
  const c = instagramCode(url);
  return c ? `https://www.instagram.com/p/${c}/embed` : null;
}

/* Vignette à afficher : thumb_url explicite > vignette auto YouTube > null
   (→ l'UI retombe sur une tuile générique + titre). */
export function mediaThumb(m) {
  if (m?.thumbUrl) return m.thumbUrl;
  const id = youtubeId(m?.url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

// URL d'embed iframe si disponible (YouTube, puis Instagram), sinon null.
export function mediaEmbed(m) {
  return youtubeEmbed(m?.url) || instagramEmbed(m?.url) || null;
}

export { safeVideoUrl };
