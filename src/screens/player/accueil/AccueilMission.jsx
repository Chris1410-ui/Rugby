import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { statusOfLog } from "../../../lib/metrics.js";
import { sessionProgress } from "../../../lib/sessionProgress.js";
import { CheckCircle, ChevronRight } from "../../../lib/icons.jsx";

/* Bloc dominant « Ce qu'il te reste » (refonte Open Design) : progression n/N,
   les actions du jour (bilan matin, séance assignée, bilan soir) avec leurs
   points du BARÈME EXISTANT (une seule monnaie), et un gros CTA « Continuer :
   [prochaine action] ». Ne fait que router vers les flux existants (feuille
   matin/soir, lecteur live) — aucune nouvelle mécanique de points ici. */
export default function AccueilMission({ me, day, todaySessions = [], logs = {}, accent = C.coral, onMorning, onSession, onEvening }) {
  const { t } = useTranslation();

  const session = todaySessions[0] || null; // séance principale du jour
  const sLog = session ? logs?.[session.id]?.[me?.id] : null;
  const sStatus = session ? statusOfLog(logs, session.id, me?.id) : null;
  const sProg = session ? sessionProgress(session, sLog) : null;

  // Actions du jour : matin + soir toujours ; séance seulement si assignée.
  const actions = useMemo(() => {
    const arr = [
      { key: "matin", label: t("player.bilan.morning"), sub: t("player.today.morningSub"), pts: 10, done: !!day?.matin, onOpen: onMorning },
    ];
    if (session) {
      arr.push({
        key: "seance",
        label: session.titre || t("player.today.session"),
        sub: t("player.session.setsCount", { done: sProg?.done ?? 0, total: sProg?.total ?? 0 }),
        pts: 10, done: sStatus === "done", onOpen: () => onSession?.(session),
      });
    }
    arr.push({ key: "soir", label: t("player.bilan.evening"), sub: t("player.today.eveningSub"), pts: 10, done: !!day?.soir, onOpen: onEvening });
    return arr;
  }, [day, session, sStatus, sProg]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = actions.length;
  const done = actions.filter((a) => a.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next = actions.find((a) => !a.done) || null;

  return (
    <div style={{ background: "linear-gradient(155deg, #2A2450 0%, #221E42 100%)", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: accent, marginBottom: 3 }}>{t("player.accueil.missionKicker")}</div>
      <div style={{ fontSize: 21, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.2, marginBottom: 14 }}>{t("player.accueil.missionTitle")}</div>

      {/* Progression */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.09)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: `linear-gradient(90deg, ${C.coral}, ${C.amb})`, transition: "width .5s cubic-bezier(.22,1,.36,1)" }} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 900 }}>{done}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.34)" }}>/{total}</span></div>
      </div>

      {/* Actions du jour */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((a) => {
          const isNext = next?.key === a.key;
          const bg = a.done ? "rgba(44,140,90,0.12)" : isNext ? "rgba(232,85,59,0.14)" : "rgba(255,255,255,0.05)";
          const bd = a.done ? "rgba(44,140,90,0.32)" : isNext ? "rgba(232,85,59,0.44)" : C.border;
          return (
            <button key={a.key} onClick={a.onOpen} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: 12, minHeight: 64, borderRadius: 13, background: bg, border: `1px solid ${bd}`, cursor: "pointer" }}>
              <span style={{ width: 26, height: 26, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: a.done ? "none" : `1.8px solid ${isNext ? C.coral : "rgba(255,255,255,0.28)"}`, background: a.done ? C.green : "transparent" }}>
                {a.done && <CheckCircle size={15} color="#fff" />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: a.done ? "rgba(255,255,255,0.5)" : "#fff", textDecoration: a.done ? "line-through" : "none" }}>{a.label}</span>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: a.done ? C.green : "rgba(255,255,255,0.34)", marginTop: 2 }}>{a.done ? t("player.accueil.pts", { n: a.pts }) : a.sub}</span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 900, color: a.done ? C.green : "rgba(255,255,255,0.34)", flexShrink: 0 }}>+{a.pts}</span>
            </button>
          );
        })}
      </div>

      {/* CTA « Continuer : … » */}
      <button
        onClick={() => next?.onOpen?.()}
        disabled={!next}
        style={{
          marginTop: 15, width: "100%", minHeight: 52, borderRadius: 13, border: next ? "none" : `1px solid rgba(44,140,90,0.55)`,
          background: next ? C.coral : "rgba(44,140,90,0.22)", color: next ? "#fff" : "#7BD6A5",
          fontSize: 15.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: next ? "pointer" : "default",
        }}
      >
        {next ? t("player.accueil.continueTo", { name: next.label }) : t("player.accueil.dayDone")}
        {next && <ChevronRight size={19} color="#fff" />}
      </button>
    </div>
  );
}
