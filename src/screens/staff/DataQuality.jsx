import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { ChevronDown, Send, AlertTriangle, CheckCircle } from "../../lib/icons.jsx";
import { displayName } from "../../lib/identity.js";
import { useReadOnly } from "../../lib/readonly.js";
import { todayISO } from "../../lib/metrics.js";
import { teamDataCompleteness } from "../../lib/dataQuality.js";
import { useTeam1RM } from "../../data/player1rm.js";
import { sendMessage } from "../../data/messages.js";
import Request1RMModal from "../shared/Request1RMModal.jsx";

const accent = C.teal;

/* « Qualité des données » (staff) — PR-1 de la couche d'analyse. Rend VISIBLE ce
   qui manque pour que les statistiques deviennent fiables (durée de séance, 1RM,
   bilans, volume de séances loggées), avec RELANCE en un clic des joueurs
   concernés. La qualité des stats dépend entièrement de la saisie : on la met en
   avant. Aucune donnée n'est inventée — on compte le réel. */
export default function DataQuality({ teamId, players = [], sessions = [], logs = {}, bilans = {} }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [sent, setSent] = useState({});
  const [reqOpen, setReqOpen] = useState(false);
  const { entries: oneRM } = useTeam1RM(teamId);

  const dq = useMemo(
    () => teamDataCompleteness({ players, sessions, logs, oneRM, bilans, today: todayISO() }),
    [players, sessions, logs, oneRM, bilans],
  );
  const nameById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, displayName(p)])), [players]);

  const deficits = [
    { key: "lowLog", d: dq.lowLog, msg: t("staff.dataq.nudgeLog") },
    { key: "noDuration", d: dq.noDuration, msg: t("staff.dataq.nudgeDuration") },
    { key: "noBilan", d: dq.noBilan, msg: t("staff.dataq.nudgeBilan") },
    { key: "no1RM", d: dq.no1RM, msg: t("staff.dataq.nudge1RM") },
  ];
  const totalGaps = deficits.reduce((a, x) => a + x.d.n, 0);

  const relance = async (item) => {
    if (readOnly || !item.d.ids.length) return;
    try {
      await Promise.all(item.d.ids.map((pid) => sendMessage(pid, { dir: "staff", author: "Staff", text: item.msg })));
      setSent((s) => ({ ...s, [item.key]: item.d.n }));
    } catch (e) { console.error("[dataq relance]", e.message); }
  };

  return (
    <div style={sc({ marginBottom: 14, padding: 0, overflow: "hidden" })}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
        {totalGaps ? <AlertTriangle size={16} color={C.amb} /> : <CheckCircle size={16} color={C.green} />}
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, textAlign: "left" }}>{t("staff.dataq.title")}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: totalGaps ? C.amb : C.green, background: `${totalGaps ? C.amb : C.green}1e`, border: `1px solid ${totalGaps ? C.amb : C.green}55`, borderRadius: 6, padding: "2px 8px" }}>{totalGaps || "✓"}</span>
        <ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: "rgba(255,255,255,0.5)" }} />
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginBottom: 10, lineHeight: 1.5 }}>{t("staff.dataq.hint")}</div>
          {!readOnly && players.length > 0 && (
            <button onClick={() => setReqOpen(true)} style={{ width: "100%", background: `${accent}18`, border: `1px solid ${accent}55`, borderRadius: 9, padding: "9px 11px", color: accent, fontSize: 12, fontWeight: 800, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🏋️ {t("request1rm.open")}</button>
          )}
          {players.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("staff.dataq.noPlayers")}</div>
          ) : totalGaps === 0 ? (
            <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{t("staff.dataq.allGood")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deficits.filter((x) => x.d.n > 0).map((item) => (
                <div key={item.key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 9, padding: "9px 11px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setExpanded(expanded === item.key ? null : item.key)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t(`staff.dataq.${item.key}`, { count: item.d.n })}</span>
                      <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>/ {dq.total}</span>
                    </button>
                    {!readOnly && (
                      sent[item.key] ? (
                        <span style={{ fontSize: 10.5, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> {t("staff.dataq.relanced", { count: sent[item.key] })}</span>
                      ) : (
                        <button onClick={() => relance(item)} style={{ background: `${accent}18`, border: `1px solid ${accent}55`, borderRadius: 8, padding: "6px 10px", color: accent, fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}><Send size={12} /> {t("staff.dataq.relance")}</button>
                      )
                    )}
                  </div>
                  {expanded === item.key && (
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.6 }}>
                      {item.d.ids.map((pid) => nameById[pid] || pid).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {reqOpen && (
        <Request1RMModal
          players={players}
          accent={accent}
          initialSelection={dq.no1RM.ids.length ? { all: false, groups: [], ids: dq.no1RM.ids } : { all: true, groups: [], ids: [] }}
          onClose={() => setReqOpen(false)}
        />
      )}
    </div>
  );
}
