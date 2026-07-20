import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { setLocaleTag } from "./locale.js";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";

/* Configuration i18n (FR par défaut, EN, NL). Détection : préférence stockée
   (localStorage) → langue du navigateur → français. La langue du PROFIL est
   adoptée au 1er login sur un appareil sans préférence (cf. adoptProfileLocale
   dans useLocale.js). Les catalogues couvrent d'abord la coquille (navigation,
   header, commun, rôles) ; les écrans sont traduits par lots. */

export const LANGS = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "nl", flag: "🇳🇱", label: "Nederlands" },
];
export const SUPPORTED = LANGS.map((l) => l.code);
export const LS_KEY = "lang";

function detectInitial() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v && SUPPORTED.includes(v)) return v;
  } catch { /* localStorage indisponible */ }
  try {
    const n = (navigator.language || "").slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(n)) return n;
  } catch { /* navigator indisponible */ }
  return "fr";
}

// Reflète la langue courante sur <html lang> (lecteurs d'écran + invite
// « traduire cette page » du navigateur). Sans effet côté Node (tests).
function applyHtmlLang(lng) {
  try { if (typeof document !== "undefined") document.documentElement.lang = lng; } catch { /* noop */ }
}

const initial = detectInitial();
setLocaleTag(initial);
applyHtmlLang(initial);
i18n.on("languageChanged", (lng) => { setLocaleTag(lng); applyHtmlLang(lng); });

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    nl: { translation: nl },
  },
  lng: initial,
  fallbackLng: "fr",
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
