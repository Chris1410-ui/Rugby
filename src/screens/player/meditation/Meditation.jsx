import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../../lib/tokens.js";
import { Sparkles, ChevronRight } from "../../../lib/icons.jsx";
import { usePreview } from "../../../lib/preview.js";
import { markMeditationDone, useMeditationToday } from "../../../data/checkins.js";
import { MED_SESSIONS, MED_GROUPS } from "./sessions.js";
import Player from "./Player.jsx";

/* Section Méditation / Relaxation (espace joueur, hub « Plus »). Liste de séances
   → lecteur commun. Thème sombre apaisant. Terminer une séance rapporte +10 pts
   (option A, une fois par jour). En aperçu (owner/staff) : lecture seule.
   Textes via i18n (namespace `meditation`). */
export default function Meditation({ me }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const { done, refresh } = useMeditationToday(me?.id);
  const [sel, setSel] = useState(null);
  const [justEarned, setJustEarned] = useState(false);

  const onComplete = async () => {
    if (preview || !me?.id) return;
    const first = !done;
    try { await markMeditationDone(me.id); await refresh(); if (first) setJustEarned(true); }
    catch { /* silencieux : la séance reste bénéfique même si le +10 échoue */ }
  };

  if (sel) {
    return <Player session={sel} alreadyDone={done} onComplete={onComplete} onClose={() => { setSel(null); setJustEarned(false); }} />;
  }

  return (
    <div>
      {/* En-tête */}
      <div style={sc({ padding: 16, marginBottom: 12, background: `radial-gradient(120% 90% at 50% -20%, ${C.viol}33 0%, ${C.card} 60%)` })}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Sparkles size={20} color={C.viol} />
          <div style={{ fontSize: 18, fontWeight: 900 }}>{t("meditation.title")}</div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 5, lineHeight: 1.5 }}>{t("meditation.subtitle")}</div>
        <div style={{ marginTop: 10 }}>
          {done ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green, background: `${C.green}1e`, border: `1px solid ${C.green}55`, borderRadius: 8, padding: "5px 10px" }}>
              ✓ {t("meditation.reward.today")}{justEarned ? ` · ${t("meditation.reward.earned")}` : ""}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.viol, background: `${C.viol}1e`, border: `1px solid ${C.viol}55`, borderRadius: 8, padding: "5px 10px" }}>
              🧘 {t("meditation.reward.points")}
            </span>
          )}
        </div>
      </div>

      {/* Groupes de séances */}
      {MED_GROUPS.map((g) => {
        const items = MED_SESSIONS.filter((s) => s.group === g.key);
        if (!items.length) return null;
        return (
          <div key={g.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,0.55)", margin: "2px 2px 8px" }}>
              {g.emoji} {t(`meditation.groups.${g.key}`).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((s) => (
                <button key={s.id} onClick={() => setSel(s)} style={sc({ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer", textAlign: "left", borderLeft: `3px solid ${s.accent}`, width: "100%" })}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${s.accent}22`, border: `1px solid ${s.accent}55` }}>
                    <Sparkles size={17} color={s.accent} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{t(`meditation.sessions.${s.id}.title`)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(`meditation.sessions.${s.id}.subtitle`)}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{s.durationMin} {t("meditation.min")}</span>
                  <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "4px 16px 8px", lineHeight: 1.5 }}>{t("meditation.footer")}</div>
    </div>
  );
}
