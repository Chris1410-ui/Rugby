import { useEffect, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { buildAlerts, SEVC, playerLoad, isoDate, todayISO, statusOfLog } from "../../lib/metrics.js";
import { KPI, Tag } from "../../lib/ui.jsx";
import { MessageSquare, ChevronRight, X, Sparkles } from "../../lib/icons.jsx";
import { useTeamMessages } from "../../data/messages.js";
import { getRecommendation } from "../../data/recommendations.js";
import Thread from "../shared/Thread.jsx";

const accent = C.coral;

/* Vue staff : alertes auto + récap hebdo + messagerie + reco IA.
   Tout est dérivé de l'effectif enrichi (aucun recalcul divergent). */
export default function Alertes({ players, sessions, logs, checkins }) {
  const [thread, setThread] = useState(null); // player pour la messagerie
  const [reco, setReco] = useState(null); // player pour la reco IA
  const [catf, setCatf] = useState("all");

  const playerIds = players.map((p) => p.id);
  const { threads } = useTeamMessages(playerIds);

  const alerts = buildAlerts(players, sessions, logs, checkins);
  const cats = ["all", ...new Set(alerts.map((a) => a.cat))];
  const shown = catf === "all" ? alerts : alerts.filter((a) => a.cat === catf);

  // récap hebdo
  const wk = sessions.filter((s) => s.date >= isoDate(new Date(Date.now() - 7 * 864e5)) && s.date <= todayISO());
  const totalAssign = wk.reduce((a, s) => a + s.assignedIds.length, 0);
  const totalDone = wk.reduce((a, s) => a + s.assignedIds.filter((pid) => statusOfLog(logs, s.id, pid) === "done").length, 0);
  const compliance = totalAssign ? Math.round((totalDone / totalAssign) * 100) : 0;
  const overload = players.filter((p) => (p._load || playerLoad(p, sessions, logs)).acwr > 1.5).length;
  const wbFilled = players.filter((p) => p._live).length;
  const unreadTotal = Object.values(threads).reduce((a, t) => a + t.unread, 0);

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
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 12 })}>Aucune alerte. Tous les indicateurs sont dans le vert. ✅</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {shown.map((a, i) => (
            <div key={i} style={sc({ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderLeft: `3px solid ${SEVC[a.sev]}` })}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: SEVC[a.sev] + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: SEVC[a.sev] }}>{a.txt}</div>
              </div>
              <button onClick={() => setReco(byId(a.pid))} title="Recommandation IA" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: C.viol, cursor: "pointer", display: "flex" }}>
                <Sparkles size={15} />
              </button>
              <button onClick={() => setThread(byId(a.pid))} title="Message" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex" }}>
                <MessageSquare size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* messagerie */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <MessageSquare size={16} color={accent} />
        <div style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Messagerie</div>
        {unreadTotal > 0 && <span style={{ background: C.coral, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "2px 8px" }}>{unreadTotal}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
        {players.map((p) => {
          const t = threads[p.id] || { count: 0, unread: 0 };
          return (
            <div key={p.id} onClick={() => setThread(p)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${t.unread ? C.coral : C.border2}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{p.num ?? "—"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{t.count ? t.count + " msg" : "—"}</div>
              </div>
              {t.unread > 0 && <span style={{ background: C.coral, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 9, padding: "1px 6px", flexShrink: 0 }}>{t.unread}</span>}
              <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
            </div>
          );
        })}
      </div>

      {thread && <Thread playerId={thread.id} name={thread.name} who="staff" accent={accent} onClose={() => setThread(null)} />}
      {reco && <RecoModal player={reco} onClose={() => setReco(null)} />}
    </section>
  );
}

function RecoModal({ player, onClose }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    getRecommendation(player)
      .then((d) => active && setState({ loading: false, text: d.recommendation, source: d.source }))
      .catch((e) => active && setState({ loading: false, error: e.message }));
    return () => { active = false; };
  }, [player]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.panel, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <Sparkles size={18} color={C.viol} />
          <div style={{ flex: 1, marginLeft: 8, fontSize: 15, fontWeight: 800 }}>Recommandation · {player.name}</div>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
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
