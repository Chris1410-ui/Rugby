import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { localeTag } from "../../../i18n/locale.js";
import { Sparkles } from "../../../lib/icons.jsx";
import { useThread } from "../../../data/messages.js";

/* « Mot du préparateur » — dernier message du staff dans le fil du joueur.
   Lecture seule ; tap → ouvre la messagerie. Masqué s'il n'y a aucun message
   staff. (Le staff n'est pas pseudonymisé, contrairement aux joueurs.) */
export default function AccueilCoach({ me, onNavigate }) {
  const { t } = useTranslation();
  const { msgs } = useThread(me?.id);
  const last = useMemo(() => [...(msgs || [])].reverse().find((m) => m.dir === "staff") || null, [msgs]);
  if (!last) return null;

  const rel = (() => {
    try {
      const rtf = new Intl.RelativeTimeFormat(localeTag(), { numeric: "auto" });
      const mins = Math.round((Date.now() - new Date(last.ts).getTime()) / 60000);
      if (mins < 60) return rtf.format(-Math.max(1, mins), "minute");
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return rtf.format(-hrs, "hour");
      return rtf.format(-Math.round(hrs / 24), "day");
    } catch { return ""; }
  })();

  return (
    <button onClick={() => onNavigate && onNavigate("messages")} style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(108,92,224,0.1)", border: `1px solid rgba(108,92,224,0.28)`, borderLeft: `3px solid ${C.viol}`, borderRadius: 18, padding: 16, marginBottom: 14, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <span style={{ width: 28, height: 28, borderRadius: 14, background: C.viol, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={15} color="#fff" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>{t("player.accueil.coachTitle")}</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.34)", fontWeight: 600 }}>{last.author ? `${last.author} · ` : ""}{rel}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.84)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{last.text}</div>
    </button>
  );
}
