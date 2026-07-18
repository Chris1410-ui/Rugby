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
    <div style={{ padding: compact ? "8px 8px 6px" : 0 }}>
      {compact && <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: 0.8, padding: "0 2px 7px" }}>🌐 {t("common.language").toUpperCase()}</div>}
      <div style={{ display: "flex", gap: 7 }}>
        {LANGS.map((l) => {
          const on = active === l.code;
          return (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              title={l.label}
              aria-label={l.label}
              aria-pressed={on}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", borderRadius: 11, cursor: "pointer", background: on ? `${C.coral}2e` : "rgba(255,255,255,0.07)", border: `2px solid ${on ? C.coral : "transparent"}`, boxShadow: on ? `0 0 0 1px ${C.coral}66` : "none", color: "#fff", transition: "background .12s" }}
            >
              <span style={{ fontSize: 27, lineHeight: 1, filter: on ? "none" : "grayscale(0.35) opacity(0.85)" }}>{l.flag}</span>
              <span style={{ fontSize: 10, fontWeight: on ? 900 : 700, color: on ? "#fff" : "rgba(255,255,255,0.65)", letterSpacing: 0.5 }}>{l.code.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
