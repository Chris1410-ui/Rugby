import { useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { buildAlerts, SEVC, playerLoad, isoDate, todayISO, statusOfLog, fmtShort } from "../../lib/metrics.js";
import { KPI, Tag, CloseX, useModalClose } from "../../lib/ui.jsx";
import { MessageSquare, Sparkles, CheckCircle } from "../../lib/icons.jsx";
import { getRecommendation } from "../../data/recommendations.js";
import { useAlertStatus, markTreated, reopenAlert } from "../../data/alerts.js";
import Conversation from "../shared/Conversation.jsx";
import PlayerReport from "../shared/PlayerReport.jsx";

const accent = C.coral;
const skey = (pid, k) => `${pid}|${k}`;

/* Vue staff : alertes auto + file de traitement + récap hebdo + reco IA.
   Alertes calculées en direct (buildAlerts) ; leur traitement (kiné/traité)
   est persisté dans alert_status. La file active = alertes du jour non traitées. */
export default function Alertes({ teamId, players, sessions, logs, checkins, activities = {} }) {
  const [thread, setThread] = useState(null); // player pour la messagerie
  const [reco, setReco] = useState(null); // player pour la reco IA
  const [report, setReport] = useState(null); // { player, reason } — récap détaillé
  const [catf, setCatf] = useState("all");
  const [histOpen, setHistOpen] = useState(false);
  const { statuses } = useAlertStatus(teamId);

  const today = todayISO();
  const treatedToday = new Set(statuses.filter((s) => s.date === today && s.treatedAt).map((s) => skey(s.playerId, s.akey)));
  const kineToday = new Set(statuses.filter((s) => s.date === today && s.kineAt).map((s) => skey(s.playerId, s.akey)));

  const alerts = buildAlerts(players, sessions, logs, checkins).filter((a) => !treatedToday.has(skey(a.pid, a.key)));
  const cats = ["all", ...new Set(alerts.map((a) => a.cat))];
  const shown = catf === "all" ? alerts : alerts.filter((a) => a.cat === catf);
  const history = statuses.filter((s) => s.treatedAt || s.kineAt);

  // récap hebdo
  const wk = sessions.filter((s) => s.date >= isoDate(new Date(Date.now() - 7 * 864e5)) && s.date <= todayISO());
  const totalAssign = wk.reduce((a, s) => a + s.assignedIds.length, 0);
  const totalDone = wk.reduce((a, s) => a + s.assignedIds.filter((pid) => statusOfLog(logs, s.id, pid) === "done").length, 0);
  const compliance = totalAssign ? Math.round((totalDone / totalAssign) * 100) : 0;
  const overload = players.filter((p) => (p._load || playerLoad(p, sessions, logs)).acwr > 1.5).length;
  const wbFilled = players.filter((p) => p._live).length;

  const byId = (pid) => players.find((p) => p.id === pid);

  return (
    <section>
      {/* récap hebdo */}
      <div style={{ borderRadius: 16, background: `linear-gradient(150deg,${accent}33,${C.panel})`, border: `1px solid ${C.border}`, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: accent, marginBottom: 4 }}>RÉCAP DE LA SEMAINE</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, marginBottom: 12 }}>
          {compliance}% de compliance · {overload} joueur{overload > 1 ? "s" : ""} en surcharge · {wbFilled}/{players.length} bilans du matin remplis.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <KPI label="COMPLIANCE 7J" value={compliance + "%"} color={compliance > 80 ? C.green : compliance > 60 ? C.amb : C.coral} />
          <KPI label="ALERTES" value={alerts.length} color={alerts.length ? C.coral : C.green} />
          <KPI label="SURCHARGE" value={overload} color={overload ? C.coral : C.green} />
        </div>
      </div>

      {/* alertes */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Alertes automatiques · {alerts.length}</div>
      </div>
      {cats.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCatf(c)} style={{ padding: "5px 11px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", background: catf === c ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>
              {c === "all" ? "Toutes" : c}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 12 })}>Aucune alerte. Tous les indicateurs sont dans le vert. ✅</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {shown.map((a, i) => {
            const transmis = kineToday.has(skey(a.pid, a.key));
            return (
            <div key={i} onClick={() => setReport({ player: byId(a.pid), reason: { ...a, color: SEVC[a.sev] } })} style={sc({ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderLeft: `3px solid ${SEVC[a.sev]}`, cursor: "pointer" })}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: SEVC[a.sev] + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{a.name}{transmis && <span style={{ fontSize: 8.5, fontWeight: 800, color: C.teal, background: `${C.teal}22`, border: `1px solid ${C.teal}66`, borderRadius: 5, padding: "1px 5px" }}>🩺 KINÉ</span>}</div>
                <div style={{ fontSize: 11, color: SEVC[a.sev] }}>{a.txt}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setReco(byId(a.pid)); }} title="Recommandation IA" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: C.viol, cursor: "pointer", display: "flex" }}>
                <Sparkles size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setThread(byId(a.pid)); }} title="Message" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex" }}>
                <MessageSquare size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); markTreated(teamId, a).catch(() => {}); }} title="Traiter (retirer de la file)" style={{ background: `${C.green}1a`, border: `1px solid ${C.green}55`, borderRadius: 8, padding: 7, color: C.green, cursor: "pointer", display: "flex" }}>
                <CheckCircle size={15} />
              </button>
            </div>
          ); })}
        </div>
      )}

      {/* Historique / traités — rien n'est perdu */}
      {history.length > 0 && (
        <>
          <button onClick={() => setHistOpen((o) => !o)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 12, textAlign: "left" }}>
            {histOpen ? "▾" : "▸"} Historique / traités · {history.length}
          </button>
          {histOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {history.map((s) => (
                <div key={s.id} style={sc({ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", opacity: 0.9 })}>
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{byId(s.playerId)?.name || "Joueur"}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{s.txt} · {fmtShort(s.date)}</div>
                  </div>
                  {s.kineAt && <Tag c={C.teal}>Kiné</Tag>}
                  {s.treatedAt ? <Tag c={C.green}>Traité</Tag> : <Tag c={C.amb}>En file</Tag>}
                  {s.treatedAt && <button onClick={() => reopenAlert(s.id).catch(() => {})} title="Réactiver" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4, fontSize: 13 }}>↩</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {thread && <Conversation playerId={thread.id} title={thread.name} who="staff" accent={accent} onClose={() => setThread(null)} />}
      {reco && <RecoModal player={reco} onClose={() => setReco(null)} />}
      {report?.player && <PlayerReport player={report.player} sessions={sessions} logs={logs} activities={activities[report.player.id] || []} reason={report.reason} onClose={() => setReport(null)} />}
    </section>
  );
}

function RecoModal({ player, onClose }) {
  const [state, setState] = useState({ loading: true });
  useModalClose(onClose);
  useEffect(() => {
    let active = true;
    getRecommendation(player)
      .then((d) => active && setState({ loading: false, text: d.recommendation, source: d.source }))
      .catch((e) => active && setState({ loading: false, error: e.message }));
    return () => { active = false; };
  }, [player]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.panel, borderRadius: 18, padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <Sparkles size={18} color={C.viol} />
          <div style={{ flex: 1, marginLeft: 8, fontSize: 15, fontWeight: 800 }}>Recommandation · {player.name}</div>
          <CloseX onClose={onClose} />
        </div>
        {state.loading ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", padding: "20px 0", textAlign: "center" }}>Analyse en cours…</div>
        ) : state.error ? (
          <div style={{ fontSize: 12, color: C.coral }}>Erreur : {state.error}</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{state.text}</div>
            <div style={{ marginTop: 14 }}>
              <Tag c={state.source === "claude" ? C.viol : C.gray}>{state.source === "claude" ? "IA · Claude (Edge Function)" : "Repli automatique"}</Tag>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
