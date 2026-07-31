import { useTranslation } from "react-i18next";
import { localeTag } from "../../../i18n/locale.js";
import { C } from "../../../lib/tokens.js";
import { Overlay } from "../../../lib/ui.jsx";
import { Megaphone } from "../../../lib/icons.jsx";

/* Fil d'actualité du club en lecture (feuille) — historique pseudonymisé côté
   joueur (l'auteur est le staff, non pseudonymisé). Lecture seule. */
export default function ClubNewsSheet({ items = [], onClose }) {
  const { t } = useTranslation();
  const fmt = (iso) => new Date(iso).toLocaleDateString(localeTag(), { weekday: "short", day: "numeric", month: "long" });
  return (
    <Overlay onClose={onClose} sheet z={320}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 18px 12px" }}>
        <Megaphone size={18} color={C.viol} />
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{t("player.home.newsTitle")}</div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t("player.today.swipeClose")}</span>
      </div>
      <div style={{ padding: "0 18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12.5, padding: 20 }}>{t("player.home.newsEmpty")}</div>
        ) : items.map((n) => (
          <div key={n.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, borderLeft: n.pinned ? `3px solid ${C.amb}` : `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
              {n.kind === "mot" && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: C.amb, background: `${C.amb}22`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "1px 6px" }}>{t("player.home.motStaff")}</span>}
              {n.pinned && <span style={{ fontSize: 11 }}>📌</span>}
              {n.title && <span style={{ fontSize: 14.5, fontWeight: 800 }}>{n.title}</span>}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.body}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", marginTop: 8 }}>{[n.authorLabel, fmt(n.publishedAt)].filter(Boolean).join(" · ")}</div>
          </div>
        ))}
      </div>
    </Overlay>
  );
}
