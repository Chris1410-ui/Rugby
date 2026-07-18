import { useTranslation } from "react-i18next";
import { C } from "../lib/tokens.js";
import { LANGS } from "./config.js";
import { setLanguage } from "./useLocale.js";

/* Sélecteur de langue par drapeaux 🇫🇷 🇬🇧 🇳🇱. Applique immédiatement (sans
   rechargement) et persiste (localStorage + profil). Utilisé dans le menu
   « Compte » du header. `compact` = variante en ligne (dans un popover). */
export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const active = i18n.language?.slice(0, 2) || "fr";

  return (
    <div style={{ padding: compact ? "8px 8px 4px" : 0 }}>
      {compact && <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 0.6, padding: "0 2px 6px" }}>{t("common.language").toUpperCase()}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        {LANGS.map((l) => {
          const on = active === l.code;
          return (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              title={l.label}
              aria-label={l.label}
              aria-pressed={on}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "7px 4px", borderRadius: 9, cursor: "pointer", background: on ? `${C.coral}22` : "rgba(255,255,255,0.05)", border: `1px solid ${on ? C.coral : C.border}`, color: "#fff" }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>{l.flag}</span>
              <span style={{ fontSize: 8.5, fontWeight: on ? 800 : 600, color: on ? "#fff" : "rgba(255,255,255,0.6)" }}>{l.code.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
