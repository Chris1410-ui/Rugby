import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { localeTag } from "../../../i18n/locale.js";
import { displayName } from "../../../lib/identity.js";
import { posDisplay, grpLabel } from "../../../lib/positions.js";

/* Hero de l'écran « Aujourd'hui » — refonte Open Design (charte : palette
   navy/coral, traitement display capitales, polices SYSTÈME). Pseudonymisé :
   totem en grand + initiales, jamais de nom réel. Un seul dégradé (le radial du
   hero), cohérent avec la palette de l'app. */
export default function AccueilHero({ me, today }) {
  const { t } = useTranslation();
  const dateStr = (() => {
    try { return new Date((today || "") + "T00:00:00").toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long" }); }
    catch { return ""; }
  })();

  const meta = [
    me?.initials ? `(${me.initials})` : null,
    posDisplay(t, me?.pos),
    grpLabel(me?.grp),
    me?.club || null,
  ].filter(Boolean);

  return (
    <div style={{ position: "relative", margin: "-18px -18px 14px", overflow: "hidden" }}>
      {/* Fond : radial violet-navy (palette) + fondu vers la surface */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 95% at 72% 12%, #4A3F7A 0%, #332C5C 46%, #1E1B3A 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(178deg, rgba(20,18,43,0.5) 0%, rgba(20,18,43,0.12) 34%, rgba(30,27,58,0.85) 74%, ${C.navy} 100%)` }} />
      <div style={{ position: "relative", padding: "20px 18px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.66)" }}>{dateStr}</span>
        </div>
        <div style={{ fontSize: "clamp(40px, 12vw, 60px)", lineHeight: 0.92, fontWeight: 900, letterSpacing: -0.5, textTransform: "uppercase", textShadow: "0 4px 26px rgba(0,0,0,0.55)" }}>
          {me?.name || displayName(me)}
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
          {meta.map((m, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {i > 0 && <span style={{ width: 3, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.28)" }} />}
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
