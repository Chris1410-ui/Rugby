import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { localeTag } from "../../i18n/locale.js";
import { displayName } from "../../lib/identity.js";
import { useIsMobile } from "../../lib/useIsMobile.js";
import { useTeamMorningCheckins } from "../../data/checkins.js";
import {
  favMarkers, recoveryIndex, wellnessScore, rpeOf, remarkOf, needsWatch, statusOf, mean,
} from "../../lib/wellnessView.js";
import { Clock, CheckCircle, AlertTriangle } from "../../lib/icons.jsx";

/* Écran « Wellness » (staff) — tableau de bord des réponses du matin.
   Convention d'affichage « plus haut = mieux » (cf. lib/wellnessView : purement
   cosmétique, aucune formule ni donnée modifiée). Pseudonymisation : totem +
   initiales (les noms civils arriveront par import, écran dédié). */
export default function Wellness({ teamId, players = [] }) { // eslint-disable-line no-unused-vars
  const { t } = useTranslation();
  const mobile = useIsMobile();

  // Effectif attendu = joueurs réels (hors démo).
  const roster = useMemo(() => players.filter((p) => !p.isDemo), [players]);
  const ids = useMemo(() => roster.map((p) => p.id), [roster]);
  const byId = useMemo(() => Object.fromEntries(roster.map((p) => [p.id, p])), [roster]);
  const { rows } = useTeamMorningCheckins(ids, 14);

  const dates = useMemo(() => [...new Set(rows.map((r) => r.date))].sort().reverse(), [rows]);
  const today = todayISO();
  const [dateSel, setDateSel] = useState("");
  const selDate = dateSel || (dates.includes(today) ? today : dates[0]) || today;
  const [athlete, setAthlete] = useState("all");

  // 1 ligne / joueur pour la date (upsert → une seule ; on garde la + récente).
  const dayByPlayer = useMemo(() => {
    const m = {};
    for (const r of rows) if (r.date === selDate) m[r.playerId] = r;
    return m;
  }, [rows, selDate]);
  const dayRows = useMemo(() => Object.values(dayByPlayer), [dayByPlayer]);
  const scopeRows = athlete === "all" ? dayRows : dayRows.filter((r) => r.playerId === athlete);

  // Baseline perso (récupération moyenne sur la fenêtre, hors date sélectionnée).
  const baseline = useMemo(() => {
    const acc = {};
    for (const r of rows) {
      if (r.date === selDate) continue;
      const rec = recoveryIndex(r.wb);
      if (rec == null) continue;
      (acc[r.playerId] ||= []).push(rec);
    }
    const out = {};
    for (const pid in acc) out[pid] = mean(acc[pid]);
    return out;
  }, [rows, selDate]);

  const nameOf = (pid) => { const p = byId[pid]; return p ? displayName(p) : "—"; };
  const initOf = (pid) => byId[pid]?.initials || null;
  const fmt = (v, d = 1) => (v == null ? "—" : v.toFixed(d));
  const timeStr = (iso) => { try { return new Date(iso).toLocaleTimeString(localeTag(), { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };

  // KPIs (scope = équipe entière ou athlète sélectionné).
  const kWellness = mean(scopeRows.map((r) => wellnessScore(r.wb)));
  const kRecovery = mean(scopeRows.map((r) => recoveryIndex(r.wb)));
  const kWatch = scopeRows.filter((r) => needsWatch(r.wb)).length;

  // Profil collectif (moyennes favorables).
  const favAvg = (key) => mean(scopeRows.map((r) => favMarkers(r.wb)[key]));
  const BARS = [
    ["wellness", t("staff.wellness.mWellness")],
    ["sommeil", t("staff.wellness.mSleep")],
    ["fatigue", t("staff.wellness.mFatigue")],
    ["stress", t("staff.wellness.mStress")],
    ["humeur", t("staff.wellness.mMood")],
    ["willTrain", t("staff.wellness.mWill")],
  ];
  const rpeAvg = mean(scopeRows.map((r) => rpeOf(r.wb)));

  // Tableau « suivi du jour » (pire récupération en tête).
  const tableRows = useMemo(() => scopeRows
    .map((r) => {
      const rec = recoveryIndex(r.wb);
      const base = baseline[r.playerId];
      return { pid: r.playerId, wb: r.wb, rec, well: wellnessScore(r.wb), rpe: rpeOf(r.wb),
        remark: remarkOf(r.wb), status: statusOf(rec), delta: rec != null && base != null ? rec - base : null, createdAt: r.createdAt };
    })
    .sort((a, b) => (a.rec ?? 99) - (b.rec ?? 99)), [scopeRows, baseline]);

  // Qui a répondu (trié par heure) et qui manque.
  const responders = useMemo(() => dayRows
    .map((r) => ({ pid: r.playerId, at: r.createdAt }))
    .filter((x) => x.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at)), [dayRows]);
  const missing = useMemo(() => roster.filter((p) => !dayByPlayer[p.id]), [roster, dayByPlayer]);

  // Histogramme par heure (local).
  const hourHist = useMemo(() => {
    const h = {};
    for (const r of responders) { const hr = new Date(r.at).getHours(); h[hr] = (h[hr] || 0) + 1; }
    const hours = Object.keys(h).map(Number);
    if (!hours.length) return [];
    const lo = Math.min(...hours), hi = Math.max(...hours);
    const out = [];
    for (let x = lo; x <= hi; x++) out.push({ hour: x, n: h[x] || 0 });
    return out;
  }, [responders]);
  const histMax = Math.max(1, ...hourHist.map((x) => x.n));

  // Alertes & remarques (vigilance/alerte + remarques).
  const alerts = useMemo(() => dayRows
    .map((r) => ({ pid: r.playerId, rec: recoveryIndex(r.wb), well: wellnessScore(r.wb), remark: remarkOf(r.wb), status: statusOf(recoveryIndex(r.wb)) }))
    .filter((x) => x.status === "vigilance" || x.status === "alerte" || x.remark)
    .sort((a, b) => (a.rec ?? 99) - (b.rec ?? 99)), [dayRows]);

  // Tendance équipe (moyennes par jour).
  const trend = useMemo(() => dates.map((d) => {
    const rs = rows.filter((r) => r.date === d);
    return { date: d, n: rs.length, well: mean(rs.map((r) => wellnessScore(r.wb))), rec: mean(rs.map((r) => recoveryIndex(r.wb))) };
  }), [dates, rows]);

  // Historique des remarques (toute la fenêtre).
  const remarkHist = useMemo(() => rows
    .map((r) => ({ pid: r.playerId, date: r.date, remark: remarkOf(r.wb), well: wellnessScore(r.wb), rec: recoveryIndex(r.wb) }))
    .filter((x) => x.remark)
    .sort((a, b) => (a.date < b.date ? 1 : -1)), [rows]);

  const dLabel = (iso) => { try { return new Date(iso + "T00:00:00").toLocaleDateString(localeTag(), { day: "numeric", month: "short" }); } catch { return iso; } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── En-tête : date + athlète + nb de réponses ── */}
      <div style={sc({ padding: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 })}>
        <Field label={t("staff.wellness.date")}>
          <select value={selDate} onChange={(e) => setDateSel(e.target.value)} style={selStyle}>
            {!dates.length && <option value={today}>{dLabel(today)}</option>}
            {dates.map((d) => <option key={d} value={d}>{dLabel(d)}</option>)}
          </select>
        </Field>
        <Field label={t("staff.wellness.athlete")}>
          <select value={athlete} onChange={(e) => setAthlete(e.target.value)} style={selStyle}>
            <option value="all">{t("staff.wellness.allTeam")}</option>
            {roster.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </select>
        </Field>
        <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: C.viol }}>
          {t("staff.wellness.nResponses", { count: scopeRows.length })}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        <Kpi label={t("staff.wellness.kResponses")} value={scopeRows.length} sub={t("staff.wellness.kResponsesSub")} color="#fff" />
        <Kpi label={t("staff.wellness.kWellness")} value={fmt(kWellness)} sub={t("staff.wellness.kWellnessSub")} color={C.blue} />
        <Kpi label={t("staff.wellness.kRecovery")} value={fmt(kRecovery)} sub={t("staff.wellness.kRecoverySub")} color={C.teal} />
        <Kpi label={t("staff.wellness.kWatch")} value={kWatch} sub={t("staff.wellness.kWatchSub")} color={kWatch > 0 ? C.amb : C.green} />
      </div>

      {/* ── Profil collectif ── */}
      <Section title={t("staff.wellness.profileTitle")} sub={t("staff.wellness.profileSub")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {BARS.map(([key, lbl]) => <Bar key={key} label={lbl} value={favAvg(key)} />)}
          <Bar label={t("staff.wellness.mRpe")} value={rpeAvg} kind="rpe" />
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.5 }}>{t("staff.wellness.rpeNote")}</div>
      </Section>

      {/* ── Qui a répondu (+ heure) · Qui n'a pas répondu ── */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Section title={t("staff.wellness.respondedTitle")} sub={t("staff.wellness.respondedSub", { count: responders.length })}>
          {hourHist.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 54, marginBottom: 12, paddingTop: 4 }}>
              {hourHist.map(({ hour, n }) => (
                <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: n ? C.teal : "rgba(255,255,255,0.3)" }}>{n || ""}</div>
                  <div style={{ width: "100%", maxWidth: 22, height: Math.max(3, (n / histMax) * 34), background: n ? C.teal : "rgba(255,255,255,0.08)", borderRadius: 3 }} />
                  <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.4)" }}>{hour}h</div>
                </div>
              ))}
            </div>
          )}
          {responders.length === 0 ? (
            <Empty text={t("staff.wellness.noResponses")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
              {responders.map(({ pid, at }) => (
                <div key={pid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 2px" }}>
                  <Totem name={nameOf(pid)} init={initOf(pid)} />
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: C.teal, fontFamily: "ui-monospace,Menlo,monospace" }}>
                    <Clock size={12} color={C.teal} />{timeStr(at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("staff.wellness.notRespondedTitle")} sub={t("staff.wellness.notRespondedSub", { count: missing.length })}>
          {missing.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 2px", color: C.green, fontSize: 13, fontWeight: 700 }}>
              <CheckCircle size={16} color={C.green} /> {t("staff.wellness.allResponded")}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {missing.map((p) => (
                <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${C.coral}14`, border: `1px solid ${C.coral}44`, borderRadius: 9, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: C.coral }} />
                  {displayName(p)}{p.initials ? <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>· {p.initials}</span> : null}
                </span>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Suivi du jour : tableau + alertes ── */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.7fr 1fr", gap: 12 }}>
        <Section title={t("staff.wellness.dayTitle")} sub={t("staff.wellness.dayLegend")}>
          {tableRows.length === 0 ? <Empty text={t("staff.wellness.noResponses")} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <th style={th}>{t("staff.wellness.colAthlete")}</th>
                    <th style={thC}>{t("staff.wellness.colWellness")}</th>
                    <th style={thC}>{t("staff.wellness.colDelta")}</th>
                    <th style={thC}>{t("staff.wellness.colRecovery")}</th>
                    <th style={thC}>{t("staff.wellness.colRpe")}</th>
                    <th style={thC}>{t("staff.wellness.colStatus")}</th>
                    <th style={th}>{t("staff.wellness.colRemark")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.pid} style={{ borderTop: `1px solid ${C.border2}` }}>
                      <td style={td}><Totem name={nameOf(r.pid)} init={initOf(r.pid)} /></td>
                      <td style={tdC}>{fmt(r.well)}<span style={muted}>/10</span></td>
                      <td style={tdC}><Delta v={r.delta} /></td>
                      <td style={tdC}>{fmt(r.rec)}<span style={muted}>/10</span></td>
                      <td style={tdC}>{r.rpe == null ? "—" : <>{r.rpe}<span style={muted}>/10</span></>}</td>
                      <td style={tdC}><StatusPill s={r.status} t={t} /></td>
                      <td style={{ ...td, color: r.remark ? "#fff" : "rgba(255,255,255,0.3)" }}>{r.remark || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title={t("staff.wellness.alertsTitle")}>
          {alerts.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 2px", color: C.green, fontSize: 12.5, fontWeight: 700 }}>
              <CheckCircle size={15} color={C.green} /> {t("staff.wellness.noAlerts")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.map((a) => (
                <div key={a.pid} style={{ borderLeft: `3px solid ${a.status === "alerte" ? C.coral : a.status === "vigilance" ? C.amb : C.green}`, paddingLeft: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    {a.status ? <StatusPill s={a.status} t={t} /> : <StatusPill s="ok" t={t} />}
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>{nameOf(a.pid)}</span>
                  </div>
                  {a.remark
                    ? <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)" }}>{a.remark}</div>
                    : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("staff.wellness.alertScores", { wellness: fmt(a.well), recovery: fmt(a.rec) })}</div>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Tendance de l'équipe ── */}
      <Section title={t("staff.wellness.trendTitle")} sub={t("staff.wellness.trendSub")}>
        {trend.length === 0 ? <Empty text={t("staff.wellness.noResponses")} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trend.map((d) => (
              <div key={d.date} style={{ display: "grid", gridTemplateColumns: mobile ? "54px 1fr" : "70px 1fr", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 800 }}>{dLabel(d.date)}<div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{t("staff.wellness.nResponses", { count: d.n })}</div></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <MiniBar label={t("staff.wellness.mWellness")} value={d.well} color={C.blue} />
                  <MiniBar label={t("staff.wellness.kRecovery")} value={d.rec} color={C.teal} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Historique des remarques ── */}
      <Section title={t("staff.wellness.remarksTitle")} sub={t("staff.wellness.remarksSub")}>
        {remarkHist.length === 0 ? <Empty text={t("staff.wellness.noRemarks")} /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <th style={th}>{t("staff.wellness.colDate")}</th>
                  <th style={th}>{t("staff.wellness.colAthlete")}</th>
                  <th style={th}>{t("staff.wellness.colRemark")}</th>
                  <th style={thC}>{t("staff.wellness.colWellness")}</th>
                  <th style={thC}>{t("staff.wellness.colRecovery")}</th>
                </tr>
              </thead>
              <tbody>
                {remarkHist.map((r, i) => (
                  <tr key={`${r.pid}-${r.date}-${i}`} style={{ borderTop: `1px solid ${C.border2}` }}>
                    <td style={td}>{dLabel(r.date)}</td>
                    <td style={td}><Totem name={nameOf(r.pid)} init={initOf(r.pid)} /></td>
                    <td style={td}>{r.remark}</td>
                    <td style={tdC}>{fmt(r.well)}<span style={muted}>/10</span></td>
                    <td style={tdC}>{fmt(r.rec)}<span style={muted}>/10</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 10 }}>{t("staff.wellness.remarksPrivacy")}</div>
      </Section>
    </div>
  );
}

/* ── Sous-composants ── */
const selStyle = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", colorScheme: "dark", minHeight: 40 };
const th = { padding: "6px 8px", fontWeight: 800 };
const thC = { ...th, textAlign: "center" };
const td = { padding: "9px 8px", verticalAlign: "middle" };
const tdC = { ...td, textAlign: "center", fontWeight: 800 };
const muted = { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 };

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{label}</span>
      {children}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={sc({ padding: 16 })}>
      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: sub ? 2 : 12 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>{sub}</div>}
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div style={sc({ padding: "14px 14px" })}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 5, lineHeight: 1.3 }}>{sub}</div>
    </div>
  );
}

function Bar({ label, value, kind = "fav" }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 10) * 100));
  const grad = kind === "rpe"
    ? `linear-gradient(90deg, ${C.green}, ${C.amb} 60%, ${C.coral})`
    : `linear-gradient(90deg, ${C.green}, ${C.blue})`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 44px", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{label}</span>
      <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: grad, borderRadius: 6, transition: "width .4s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, textAlign: "right" }}>{value == null ? "—" : value.toFixed(1)}</span>
    </div>
  );
}

function MiniBar({ label, value, color }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "84px 1fr 34px", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{label}</span>
      <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, textAlign: "right" }}>{value == null ? "—" : value.toFixed(1)}</span>
    </div>
  );
}

function Totem({ name, init }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      {init && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{init}</span>}
    </span>
  );
}

function Delta({ v }) {
  if (v == null) return <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>;
  const up = v > 0.25, down = v < -0.25;
  const col = up ? C.green : down ? C.coral : "rgba(255,255,255,0.5)";
  const arrow = up ? "▲" : down ? "▼" : "–";
  return <span style={{ color: col, fontWeight: 800, fontSize: 11.5 }}>{arrow} {Math.abs(v).toFixed(1)}</span>;
}

function StatusPill({ s, t }) {
  const map = {
    ok: { c: C.green, l: t("staff.wellness.statusOk"), I: CheckCircle },
    vigilance: { c: C.amb, l: t("staff.wellness.statusVigilance"), I: AlertTriangle },
    alerte: { c: C.coral, l: t("staff.wellness.statusAlerte"), I: AlertTriangle },
  };
  const m = map[s] || map.ok;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${m.c}1c`, border: `1px solid ${m.c}55`, color: m.c, borderRadius: 7, padding: "2px 8px", fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>
      <m.I size={11} color={m.c} />{m.l}
    </span>
  );
}

function Empty({ text }) {
  return <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 12.5, padding: "18px 8px" }}>{text}</div>;
}
