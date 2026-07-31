import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { Trophy, Flame, MessageSquare, Shield, Sparkles, Calendar } from "../../../lib/icons.jsx";

/* Accès rapide (grille) — refonte Open Design. Tuiles vers les écrans existants
   (nav du lot 2 + hub « Plus »). Pastilles de non-lus conservées. */
export default function AccueilQuickAccess({ onNavigate, badges = {} }) {
  const { t } = useTranslation();
  const tiles = [
    { key: "classement", label: t("nav.classement"), Icon: Trophy },
    { key: "defis", label: t("nav.defis"), Icon: Flame, badge: badges.defis },
    { key: "messages", label: t("nav.messages"), Icon: MessageSquare, badge: badges.messages },
    { key: "fiche", label: t("nav.fiche"), Icon: Shield },
    { key: "meditation", label: t("nav.meditation"), Icon: Sparkles },
    { key: "calendrier", label: t("nav.calendrier"), Icon: Calendar },
  ];
  return (
    <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.34)", marginBottom: 12 }}>{t("player.accueil.quickAccess")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {tiles.map(({ key, label, Icon, badge }) => (
          <button key={key} onClick={() => onNavigate && onNavigate(key)} style={{ position: "relative", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 13, padding: "13px 6px", minHeight: 76, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            <Icon size={21} color="rgba(255,255,255,0.56)" />
            {label}
            {typeof badge === "number" && badge > 0 && (
              <span style={{ position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: C.coral, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge > 9 ? "9+" : badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
