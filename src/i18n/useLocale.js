import i18n, { LS_KEY, SUPPORTED } from "./config.js";

/* Changement de langue : applique immédiatement (react-i18next re-rend) et
   persiste sur l'appareil (localStorage). La synchronisation avec le PROFIL
   (colonne `profiles.locale`, pour suivre l'utilisateur d'un appareil à l'autre)
   arrivera avec la migration dédiée — voir adoptProfileLocale ci-dessous, prêt
   à être branché une fois la colonne créée. */
export function setLanguage(code) {
  if (!SUPPORTED.includes(code)) return;
  i18n.changeLanguage(code);
  try { localStorage.setItem(LS_KEY, code); } catch { /* noop */ }
}

/* Adopte la langue du profil au 1er login sur un appareil qui n'a PAS encore de
   préférence locale explicite (le choix local prime ensuite, jamais écrasé).
   Inerte tant que `profiles.locale` n'existe pas (locale = undefined). */
export function adoptProfileLocale(locale) {
  if (!locale || !SUPPORTED.includes(locale)) return;
  let hasLocal = false;
  try { hasLocal = Boolean(localStorage.getItem(LS_KEY)); } catch { /* noop */ }
  if (!hasLocal && i18n.language !== locale) {
    i18n.changeLanguage(locale);
    try { localStorage.setItem(LS_KEY, locale); } catch { /* noop */ }
  }
}
