import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { acwrZ, computePoints, statusOfLog, fmtShort, ACTIVITIES } from "../../lib/metrics.js";
import { Ring, Section, KPI, Tag } from "../../lib/ui.jsx";
import { X, MessageSquare, Shield } from "../../lib/icons.jsx";
import { usePlayerCheckins } from "../../data/checkins.js";
import Conversation from "./Conversation.jsx";
import TestsEvolution from "./TestsEvolution.jsx";

const accent = C.coral;

// Marqueurs bien-être (ordre = écran joueur) + sens d'amélioration.
const WB = [
  { k: "sleep", l: "Sommeil", better: "up" },
  { k: "energy", l: "Énergie", better: "up" },
  { k: "mood", l: "Humeur", better: "up" },
  { k: "fatigue", l: "Fatigue", better: "down" },
  { k: "soreness", l: "Courbatures", better: "down" },
  { k: "stress", l: "Stress", better: "down" },
];
const actLabel = Object.fromEntries(ACTIVITIES.map((a) => [a.key, `${a.emoji} ${a.label}`]));

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("fr-BE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
};

/* Récap complet d'un joueur (vue préparateur) — AFFICHAGE SEUL : lit l'effectif
   enrichi (enrichPlayers) + les logs + les bilans, sans aucun recalcul. Ouvert
   depuis une alerte (avec `reason`) ou l'effectif. */
export default function PlayerReport({ player, sessions, logs, activities = [], reason, onClose, onEditFiche }) {
  const [thread, setThread] = useState(false);
  const { checkins } = usePlayerCheckins(player.id);
  const cur = checkins[0] || null;      // bilan le plus récent
  const prev = checkins[1] || null;     // bilan précédent (évolution)

  const pts = computePoints(player, sessions, logs, activities);
  const zone = acwrZ(player.acwr);

  // Dernières séances assignées (récentes d'abord) + statut + RPE.
  const mine = sessions
    .filter((s) => s.assignedIds?.includes(player.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((s) => ({ s, st: statusOfLog(logs, s.id, player.id), rpe: logs?.[s.id]?.[player.id]?.rpe }));

  const stCfg = { done: { c: C.green, l: "Fait" }, missed: { c: C.coral, l: "Manqué" }, postponed: { c: C.gray, l: "Reporté" }, pending: { c: C.amb, l: "À venir" } };

  return (
    <>
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 340, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: C.navy, borderRadius: 18, padding: 18, maxHeight: "92vh", overflowY: "auto" }}>
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Ring val={player.readiness} max={100} color={player.readiness > 70 ? C.green : player.readiness > 50 ? C.amb : C.coral} label="ready" size={58} sw={5} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>{player.name}{player.isDemo && <span style={{ fontSize: 8.5, fontWeight: 800, color: C.viol, background: `${C.viol}22`, border: `1px solid ${C.viol}55`, borderRadius: 5, padding: "1px 5px" }}>DÉMO</span>}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>#{player.num ?? "—"} · {player.pos} · {grpLabel(player.grp)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontStyle: "italic", color: pts.div.c }}>{pts.pts}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{pts.div.e} {pts.div.l}</div>
          </div>
          <X size={20} color="rgba(255,255,255,0.6)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        {/* Raison de l'alerte (si ouvert depuis une alerte) */}
        {reason && (
          <div style={sc({ marginBottom: 12, borderLeft: `4px solid ${reason.color || C.coral}`, background: `${reason.color || C.coral}1a` })}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: reason.color || C.coral, marginBottom: 3 }}>⚠ ALERTE · {reason.cat}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{reason.icon} {reason.txt}</div>
          </div>
        )}

        {/* Bilan du jour détaillé */}
        <Section title="BILAN DU JOUR" right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{cur ? fmtDateTime(cur.createdAt) : "non rempli"}</span>}>
          {!cur ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Aucun bilan enregistré récemment.</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                {WB.map((m) => {
                  const v = cur.wb?.[m.k];
                  const pv = prev?.wb?.[m.k];
                  const d = v != null && pv != null ? v - pv : null;
                  const improved = d == null || d === 0 ? null : (m.better === "up" ? d > 0 : d < 0);
                  const dc = improved == null ? "rgba(255,255,255,0.4)" : improved ? C.green : C.coral;
                  return (
                    <div key={m.k} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{m.l}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontSize: 17, fontWeight: 800 }}>{v ?? "—"}</span><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>/10</span>
                        {d != null && d !== 0 && <span style={{ fontSize: 10, fontWeight: 800, color: dc }}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <Tag c={C.viol}>💤 {cur.sleepH ?? "—"} h</Tag>
                <Tag c={C.teal}>💧 {cur.hydra ?? "—"} L</Tag>
                {cur.fc != null && <Tag c={C.coral}>FC {cur.fc}</Tag>}
                {cur.hrv != null && <Tag c={C.green}>HRV {cur.hrv}</Tag>}
                {cur.poids != null && <Tag c={C.blue}>{cur.poids} kg</Tag>}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Activité déclarée</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(cur.activities || []).length === 0
                  ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Aucune</span>
                  : cur.activities.map((a) => <Tag key={a} c={C.green}>{actLabel[a] || a}</Tag>)}
              </div>
            </>
          )}
        </Section>

        {/* Charge */}
        <Section title="CHARGE">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <KPI label="ACWR" value={player.acwr?.toFixed?.(2) ?? player.acwr} color={zone.c} sub={zone.l} />
            <KPI label="CHARGE 7J" value={player.charge7j} sub="UA" color={C.coral} />
            <KPI label="MONOTONIE" value={player.monotonie} color={player.monotonie > 2 ? C.amb : C.green} />
            <KPI label="STRAIN" value={player.strain} color={C.viol} />
            <KPI label="RISQUE" value={player.risque} sub="/100" color={player.risque >= 60 ? C.coral : player.risque >= 40 ? C.amb : C.green} />
            <KPI label="BIEN-ÊTRE" value={`${player.wellness}/50`} color={C.blue} />
          </div>
        </Section>

        {/* Compliance / dernières séances */}
        <Section title="DERNIÈRES SÉANCES" right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{pts.doneCount} faites · {pts.missedCount} manquées</span>}>
          {mine.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Aucune séance assignée.</div>
          ) : mine.map(({ s, st, rpe }) => {
            const cfg = stCfg[st] || stCfg.pending;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.c, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, width: 54 }}>{fmtShort(s.date)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.code} · {s.titre}</span>
                {rpe != null && st === "done" && <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>RPE {rpe}</span>}
                <Tag c={cfg.c}>{cfg.l}</Tag>
              </div>
            );
          })}
        </Section>

        {/* Tests (évolution par campagne, lecture seule) */}
        <TestsEvolution player={player} canEdit={false} />

        {/* Points */}
        <Section title="POINTS" right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{pts.streak >= 3 ? `série ${pts.streak} 🔥` : ""}</span>}>
          {pts.badges.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {pts.badges.map((b) => <Tag key={b.l} c={C.amb}>{b.e} {b.l}</Tag>)}
            </div>
          )}
          {pts.ev.slice(0, 6).map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{e.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{fmtShort(e.date)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: e.v >= 0 ? C.green : C.coral }}>{e.v >= 0 ? "+" : ""}{e.v}</span>
              </span>
            </div>
          ))}
        </Section>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={() => setThread(true)} style={{ flex: 1, background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><MessageSquare size={15} /> Envoyer un message</button>
          {onEditFiche && (
            <button onClick={() => { onEditFiche(); onClose(); }} style={{ flex: "0 0 auto", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Shield size={15} /> Fiche</button>
          )}
        </div>
      </div>
    </div>
    {thread && (
      <div style={{ position: "fixed", inset: 0, zIndex: 350 }}>
        <Conversation playerId={player.id} title={player.name} who="staff" accent={accent} onClose={() => setThread(false)} />
      </div>
    )}
    </>
  );
}
