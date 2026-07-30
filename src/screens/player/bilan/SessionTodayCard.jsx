import { useTranslation } from "react-i18next";
import { C, sessionCodeLabel } from "../../../lib/tokens.js";
import { effectiveNature, natureLabel } from "../../../lib/nature.js";
import { sessionProgress } from "../../../lib/sessionProgress.js";
import { CheckCircle } from "../../../lib/icons.jsx";

/* Carte « Séance du jour » — reprend la maquette Terrain : titre, bandeau
   contextuel (nature/code + semaine), méta compacte (durée · X/Y séries),
   barre de progression, gros bouton « Démarrer » pleine largeur en coral.
   Alimentée par la VRAIE séance assignée du jour + son log ; « Démarrer »
   ouvre le lecteur set-par-set EXISTANT (aucun changement au lecteur → le
   pré-remplissage 1RM/reps est préservé). Le compteur X/Y reflète l'avancement
   réel du log (lib/sessionProgress). */
export default function SessionTodayCard({ s, log, accent = C.coral, onStart }) {
  const { t } = useTranslation();
  const st = log?.status || "pending";
  const { done, total } = sessionProgress(s, log);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const context = [
    natureLabel(t, effectiveNature(s.nature, s.code)),
    sessionCodeLabel(t, s.code),
    s.sourceWeek ? t("player.session.weekN", { n: s.sourceWeek }) : null,
  ].filter(Boolean).join(" · ");

  const isDone = st === "done";
  const started = !isDone && done > 0;
  const btnLabel = isDone ? t("player.today.sessionReview") : started ? t("player.today.sessionResume") : t("player.today.sessionStart");

  return (
    <div style={{ background: C.card, border: `1px solid ${isDone ? `${C.green}55` : `${C.coral}55`}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🏋️</span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{t("player.today.sessionKicker")}</span>
          {isDone && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: `${C.green}22`, border: `1px solid ${C.green}66`, color: C.green }}>
              <CheckCircle size={11} /> {t("player.today.done")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.15 }}>{s.titre || t("player.today.session")}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 5 }}>{context}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 8, fontWeight: 600 }}>
          {t("player.today.sessionMeta", { min: s.dur || 60, done, total })}
        </div>
      </div>

      {/* Barre de progression (avancement réel du log) */}
      <div style={{ height: 5, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: C.green, transition: "width .5s ease" }} />
      </div>

      <div style={{ padding: 14 }}>
        <button onClick={onStart} style={{
          width: "100%", minHeight: 52, borderRadius: 14, border: "none", cursor: "pointer",
          background: isDone ? "rgba(255,255,255,0.08)" : accent,
          color: isDone ? "rgba(255,255,255,0.85)" : "#fff",
          fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {!isDone && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          )}
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
