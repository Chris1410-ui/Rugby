import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { Sparkles, MessageSquare, CheckCircle } from "../../lib/icons.jsx";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { useReadOnly } from "../../lib/readonly.js";
import { todayISO } from "../../lib/metrics.js";
import { teamRecommendations } from "../../lib/coaching.js";
import { useTeam1RM } from "../../data/player1rm.js";
import { sendMessage } from "../../data/messages.js";

const accent = C.viol;
const sevColor = { high: C.coral, med: C.amb, low: C.teal };
const KIND_ICON = { overload: "⚡", undertrain: "📉", monotony: "🔁", prevention: "🩹", lowReadiness: "🔋", adherence: "📋", reengage: "👋" };

/* « Recommandations » (staff) — PR-5 de la couche d'analyse. Synthèse déterministe
   à l'échelle de l'effectif : combine fiabilité (PR-1), adhérence (PR-2) et
   charge/readiness en actions priorisées et GATÉES par la fiabilité. Complète le
   triage aigu (Alertes) et le conseil IA en prose (bouton ✨ par joueur). Aucune
   donnée inventée ; on ne conseille pas sur des données trop minces. */
export default function Recommandations({ teamId, players = [], sessions = [], logs = {}, bilans = {} }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { entries: oneRM } = useTeam1RM(teamId);
  const [sent, setSent] = useState({});

  const rec = useMemo(
    () => teamRecommendations({ players, sessions, logs, bilans, oneRM, today: todayISO() }),
    [players, sessions, logs, bilans, oneRM],
  );

  const evidenceText = (r) => {
    const e = r.evidence || {};
    if (r.kind === "overload" || r.kind === "undertrain") return t("staff.recos.evAcwr", { acwr: e.acwr });
    if (r.kind === "monotony") return t("staff.recos.evMonotony", { monotony: e.monotony });
    if (r.kind === "prevention") return t("staff.recos.evRisk", { risque: e.risque });
    if (r.kind === "lowReadiness") return t("staff.recos.evReadiness", { readiness: e.readiness });
    if (r.kind === "adherence") return e.rate == null ? "" : t("staff.recos.evRate", { pct: Math.round(e.rate * 100) });
    return "";
  };

  const nudge = async (pl) => {
    if (readOnly || sent[pl.playerId]) return;
    try {
      await sendMessage(pl.playerId, { dir: "staff", author: "Staff", text: t("staff.recos.msgEngage") });
      setSent((s) => ({ ...s, [pl.playerId]: true }));
    } catch (e) { console.error("[recos nudge]", e.message); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Sparkles size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.recos.title")}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 12 }}>{t("staff.recos.hint")}</div>

      {!players.length ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>{t("staff.recos.noPlayers")}</div>
      ) : rec.nPlayers === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: C.green, fontSize: 12.5, lineHeight: 1.6 })}>
          <CheckCircle size={22} color={C.green} /><div style={{ marginTop: 6 }}>{t("staff.recos.allClear")}</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {["high", "med", "low"].map((sv) => rec.counts[sv] > 0 && (
              <span key={sv} style={{ fontSize: 11, fontWeight: 800, color: sevColor[sv], background: `${sevColor[sv]}18`, border: `1px solid ${sevColor[sv]}44`, borderRadius: 8, padding: "4px 10px" }}>
                {rec.counts[sv]} · {t(`staff.recos.sev_${sv}`)}
              </span>
            ))}
          </div>

          {rec.players.map((pl) => (
            <div key={pl.playerId} style={sc({ marginBottom: 8, padding: 13, borderColor: `${sevColor[pl.topSev]}55` })}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: sevColor[pl.topSev], flexShrink: 0 }} />
                <div style={{ fontSize: 13.5, fontWeight: 800, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(pl)}</div>
                {pl.grp && <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{grpLabel(pl.grp)}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {pl.recos.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, lineHeight: "18px", flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: sevColor[r.sev] }}>{t(`staff.recos.kind_${r.kind}`)}{evidenceText(r) ? <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}> · {evidenceText(r)}</span> : null}</div>
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.45, marginTop: 1 }}>{t(`staff.recos.act_${r.kind}`)}</div>
                    </div>
                  </div>
                ))}
              </div>
              {!readOnly && pl.engagement && (
                <button onClick={() => nudge(pl)} disabled={sent[pl.playerId]} style={{ marginTop: 10, background: sent[pl.playerId] ? `${C.green}18` : "rgba(255,255,255,0.06)", border: `1px solid ${sent[pl.playerId] ? C.green : C.border}`, borderRadius: 8, padding: "7px 11px", color: sent[pl.playerId] ? C.green : "rgba(255,255,255,0.8)", fontSize: 11.5, fontWeight: 700, cursor: sent[pl.playerId] ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {sent[pl.playerId] ? <><CheckCircle size={13} /> {t("staff.recos.sent")}</> : <><MessageSquare size={13} /> {t("staff.recos.reach")}</>}
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
