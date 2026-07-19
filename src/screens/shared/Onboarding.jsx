import { useState } from "react";
import { C, FONT } from "../../lib/tokens.js";
import { Sun, Dumbbell, Flame, Trophy, Activity, Users, ClipboardList, BookOpen } from "../../lib/icons.jsx";

/* Tour guidé au 1er lancement (par rôle), passable à tout moment. Slides plein
   écran, thème sombre, points de progression, Précédent / Suivant / Passer.
   Contenu déclaratif par rôle. Purement présentiel : la persistance (« vu ») est
   gérée par l'appelant via onClose (cf. AppShell). */

const SLIDES = {
  joueur: [
    { icon: Activity, accent: C.green, title: "Bienvenue 👋", text: "Voici ton espace joueur. En quelques écrans, on te montre l'essentiel. Tu peux passer ce tour à tout moment." },
    { icon: Sun, accent: C.viol, title: "Ton bilan quotidien", text: "Chaque jour, remplis ton bilan du matin (bien-être, sommeil, poids) et du soir. C'est la base de ton suivi et de ta readiness." },
    { icon: Dumbbell, accent: C.blue, title: "Tes séances", text: "Retrouve tes séances programmées, valide-les et note tes ressentis (RPE, charges). Le staff voit ta progression en direct." },
    { icon: Flame, accent: C.coral, title: "Les défis", text: "Relève les défis lancés par le staff pour gagner des points bonus. Tu peux aussi refuser un défi qui ne te convient pas." },
    { icon: Trophy, accent: C.amb, title: "Le classement", text: "Bilans, séances, activités et défis te rapportent des points. Grimpe les divisions et compare-toi à ton équipe." },
    { icon: Activity, accent: C.viol, title: "Où je me situe", text: "Compare tes tests physiques à la moyenne de ton équipe et de ta ligne, avec le repère Top 14. À toi de viser plus haut !" },
  ],
  staff: [
    { icon: Activity, accent: C.coral, title: "Bienvenue 👋", text: "Voici ton espace staff. Petit tour des sections principales — passable à tout moment." },
    { icon: Users, accent: C.green, title: "Tes joueurs", text: "L'effectif, les fiches détaillées (tests physiques, poids, ×PdC) et l'ajout de joueurs se gèrent depuis l'écran Joueurs." },
    { icon: Activity, accent: C.amb, title: "Le suivi", text: "Readiness, charge, ACWR et alertes te signalent qui surveiller. Traite les alertes ou transmets-les au kiné." },
    { icon: BookOpen, accent: C.blue, title: "Programmes & camps", text: "Crée des programmes, planifie des camps et des campagnes de tests, et assigne le tout à tes joueurs." },
    { icon: Flame, accent: C.viol, title: "Les défis", text: "Lance des défis paramétrables (points, validation en deux temps) pour motiver et animer le groupe." },
    { icon: ClipboardList, accent: C.teal, title: "La comparaison", text: "Compare deux joueurs, ou un joueur à la moyenne équipe / ligne, sur les 9 tests (tableau, barres, radar, repère Top 14)." },
  ],
};

export default function Onboarding({ role, onClose }) {
  const slides = SLIDES[role] || SLIDES.joueur;
  const [i, setI] = useState(0);
  const last = i === slides.length - 1;
  const s = slides[i];
  const Icon = s.icon;

  const next = () => (last ? onClose?.() : setI((n) => n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  const btn = (bg, extra = {}) => ({ border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 800, fontSize: 14, ...extra, background: bg });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, fontFamily: FONT, color: "#fff", display: "flex", flexDirection: "column",
      background: `radial-gradient(130% 70% at 50% -10%, ${s.accent}44 0%, ${C.navy} 55%)`, transition: "background .5s ease" }}>
      {/* Passer (toujours visible) */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 18px" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "7px 14px", color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Passer</button>
      </div>

      {/* Slide */}
      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px", animation: "obFade .45s ease" }}>
        <div style={{ width: 108, height: 108, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26,
          background: `${s.accent}22`, border: `1.5px solid ${s.accent}66`, boxShadow: `0 10px 40px ${s.accent}44` }}>
          <Icon size={48} color={s.accent} />
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, color: s.accent, marginBottom: 10 }}>ÉTAPE {i + 1} / {slides.length}</div>
        <div style={{ fontSize: 25, fontWeight: 900, marginBottom: 14, maxWidth: 420 }}>{s.title}</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", maxWidth: 400 }}>{s.text}</div>
      </div>

      {/* Points de progression */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        {slides.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`Étape ${k + 1}`} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer",
            background: k === i ? s.accent : "rgba(255,255,255,0.22)", transition: "width .3s, background .3s" }} />
        ))}
      </div>

      {/* Contrôles */}
      <div style={{ display: "flex", gap: 10, padding: "0 20px 26px", maxWidth: 520, width: "100%", margin: "0 auto" }}>
        <button onClick={prev} disabled={i === 0} style={btn("rgba(255,255,255,0.08)", { flex: 1, padding: 14, border: `1px solid ${C.border}`, color: "rgba(255,255,255,0.85)", opacity: i === 0 ? 0.4 : 1, cursor: i === 0 ? "default" : "pointer" })}>Précédent</button>
        <button onClick={next} style={btn(s.accent, { flex: 2, padding: 14, boxShadow: `0 6px 20px ${s.accent}55` })}>{last ? "Commencer 🎉" : "Suivant"}</button>
      </div>

      <style>{`@keyframes obFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
