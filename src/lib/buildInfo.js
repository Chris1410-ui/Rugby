/* global __APP_VERSION__, __BUILD_SHA__, __BUILD_TIME__ */
/* Infos de build injectées par Vite (cf. vite.config.js `define`). Repli sûr si
   absentes (tests, exécution hors build). Sert l'indicateur de version affiché
   dans le menu Compte — pour repérer un bundle/cache périmé en un coup d'œil. */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
export const BUILD_SHA = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";
export const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

// Étiquette compacte : « v0.1.0 · 102f94e · 2026-07-23 05:14 ».
export const BUILD_LABEL = `v${APP_VERSION} · ${BUILD_SHA}${BUILD_TIME ? ` · ${BUILD_TIME}` : ""}`;
