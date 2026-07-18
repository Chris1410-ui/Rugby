/* Locale BCP47 courant pour le formatage des dates/nombres — DÉCOUPLÉ de
   react-i18next pour que la logique pure (lib/metrics.js, tests) n'importe pas
   tout le moteur i18n. `config.js` met à jour ce tag à chaque changement de
   langue ; les helpers de date lisent `localeTag()`. */

const TAG = { fr: "fr-BE", en: "en-GB", nl: "nl-BE" };
let current = "fr-BE";

export function setLocaleTag(lang) {
  current = TAG[lang] || "fr-BE";
}

export function localeTag() {
  return current;
}
