/* global __APP_VERSION__, __BUILD_SHA__, __BUILD_TIME__ */
/* Infos de build injectées par Vite (cf. vite.config.js `define`). Repli sûr si
   absentes (tests, exécution hors build). Sert l'indicateur de version affiché
   dans le menu Compte — pour repérer un bundle/cache périmé en un coup d'œil. */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
export const BUILD_SHA = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";
export const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

// Étiquette compacte : « v0.1.0 · 102f94e · 2026-07-23 05:14 ».
export const BUILD_LABEL = `v${APP_VERSION} · ${BUILD_SHA}${BUILD_TIME ? ` · ${BUILD_TIME}` : ""}`;

/* Interroge /version.json (généré au build, sans cache) → SHA réellement
   déployé. Compare au SHA en cours. Lève si le fichier est absent (ancien
   déploiement, dev) → l'appelant fera un rechargement forcé par sécurité. */
export async function checkForUpdate() {
  const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const latest = await res.json();
  return { latestSha: latest?.sha || null, currentSha: BUILD_SHA, upToDate: (latest?.sha || null) === BUILD_SHA };
}

/* Vide les caches (Cache Storage) puis recharge → force la récupération du
   dernier index.html (no-cache) et donc du dernier bundle hashé. */
export async function clearCachesAndReload() {
  try {
    if (typeof caches !== "undefined" && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* noop */ }
  try { location.reload(); } catch { /* noop */ }
}
