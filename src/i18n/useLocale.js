import i18n, { LS_KEY, SUPPORTED } from "./config.js";
import { supabase } from "../lib/supabase.js";

/* Changement de langue (sélecteur drapeaux) : applique immédiatement
   (react-i18next re-rend, sans reload), persiste sur l'appareil (localStorage,
   pour l'affichage instantané / hors-ligne) ET sur le PROFIL via une RPC
   SECURITY DEFINER qui ne touche que `profiles.locale` — pas de policy UPDATE
   ouverte sur profiles (sinon un compte pourrait changer son rôle/club). */
export function setLanguage(code) {
  if (!SUPPORTED.includes(code)) return;
  i18n.changeLanguage(code);
  try { localStorage.setItem(LS_KEY, code); } catch { /* noop */ }
  // Best-effort : hors-ligne ou non connecté → la préférence locale suffit.
  supabase.rpc("set_my_locale", { p_locale: code }).then(() => {}, () => {});
}

/* Applique la langue DU PROFIL au login. Priorité profil > localStorage : le
   compte fait autorité (on retrouve sa langue sur n'importe quel appareil) et on
   aligne localStorage. Si le profil n'a pas de langue (null), on ne touche à
   rien → repli localStorage puis FR (détection initiale de config.js). */
export function applyProfileLocale(locale) {
  if (!locale || !SUPPORTED.includes(locale)) return;
  if (i18n.language !== locale) i18n.changeLanguage(locale);
  try { localStorage.setItem(LS_KEY, locale); } catch { /* noop */ }
}
