import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, FONT } from "../../lib/tokens.js";
import { Sun, Dumbbell, Flame, Trophy, Activity, Users, ClipboardList, BookOpen } from "../../lib/icons.jsx";

/* Tour guidé au 1er lancement (par rôle), passable à tout moment. Slides plein
   écran, thème sombre, points de progression, Précédent / Suivant / Passer.
   Textes via i18n (namespace `onboarding`) ; icônes/accents restent en code.
   Purement présentiel : la persistance (« vu ») est gérée par l'appelant. */

// Icône + accent par slide et par rôle (même ordre que onboarding.slides.*).
const META = {
  joueur: [
    { icon: Activity, accent: C.green }, { icon: Sun, accent: C.viol }, { icon: Dumbbell, accent: C.blue },
    { icon: Flame, accent: C.coral }, { icon: Trophy, accent: C.amb }, { icon: Activity, accent: C.viol },
  ],
  staff: [
    { icon: Activity, accent: C.coral }, { icon: Users, accent: C.green }, { icon: Activity, accent: C.amb },
    { icon: BookOpen, accent: C.blue }, { icon: Flame, accent: C.viol }, { icon: ClipboardList, accent: C.teal },
  ],
};

export default function Onboarding({ role, onClose }) {
  const { t } = useTranslation();
  const key = role === "staff" ? "staff" : "joueur";
  const meta = META[key];
  const slides = t(`onboarding.slides.${key}`, { returnObjects: true });
  const list = Array.isArray(slides) ? slides : [];
  const [i, setI] = useState(0);
  const idx = Math.min(i, Math.max(0, list.length - 1));
  const last = idx === list.length - 1;
  const s = list[idx] || { title: "", text: "" };
  const m = meta[idx] || meta[0];
  const Icon = m.icon;
  const accent = m.accent;

  const next = () => (last ? onClose?.() : setI(idx + 1));
  const prev = () => setI(Math.max(0, idx - 1));
  const btn = (bg, extra = {}) => ({ border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 800, fontSize: 14, ...extra, background: bg });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, fontFamily: FONT, color: "#fff", display: "flex", flexDirection: "column",
      background: `radial-gradient(130% 70% at 50% -10%, ${accent}44 0%, ${C.navy} 55%)`, transition: "background .5s ease" }}>
      {/* Passer (toujours visible) */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 18px" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "7px 14px", color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t("onboarding.skip")}</button>
      </div>

      {/* Slide */}
      <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px", animation: "obFade .45s ease" }}>
        <div style={{ width: 108, height: 108, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26,
          background: `${accent}22`, border: `1.5px solid ${accent}66`, boxShadow: `0 10px 40px ${accent}44` }}>
          <Icon size={48} color={accent} />
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, color: accent, marginBottom: 10 }}>{t("onboarding.step", { n: idx + 1, total: list.length })}</div>
        <div style={{ fontSize: 25, fontWeight: 900, marginBottom: 14, maxWidth: 420 }}>{s.title}</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", maxWidth: 400 }}>{s.text}</div>
      </div>

      {/* Points de progression */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        {list.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={t("onboarding.step", { n: k + 1, total: list.length })} style={{ width: k === idx ? 22 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer",
            background: k === idx ? accent : "rgba(255,255,255,0.22)", transition: "width .3s, background .3s" }} />
        ))}
      </div>

      {/* Contrôles */}
      <div style={{ display: "flex", gap: 10, padding: "0 20px 26px", maxWidth: 520, width: "100%", margin: "0 auto" }}>
        <button onClick={prev} disabled={idx === 0} style={btn("rgba(255,255,255,0.08)", { flex: 1, padding: 14, border: `1px solid ${C.border}`, color: "rgba(255,255,255,0.85)", opacity: idx === 0 ? 0.4 : 1, cursor: idx === 0 ? "default" : "pointer" })}>{t("onboarding.prev")}</button>
        <button onClick={next} style={btn(accent, { flex: 2, padding: 14, boxShadow: `0 6px 20px ${accent}55` })}>{last ? t("onboarding.start") : t("onboarding.next")}</button>
      </div>

      <style>{`@keyframes obFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
