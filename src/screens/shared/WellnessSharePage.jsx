import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, FONT } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { fetchSharedWellness } from "../../data/wellnessShare.js";
import { buildReportModel, exportWellnessPptx, clubLabel } from "../../lib/wellnessReport.js";
import { Download, Lock, CheckCircle, AlertTriangle } from "../../lib/icons.jsx";

/* Page PUBLIQUE de consultation Wellness (sans compte). Rendue AVANT tout gate
   d'auth (cf. App.jsx). Lecture seule : vue du jour + tendance 14 j + export PPT.
   Pseudonymisé (totem + initiales) ; aucun nom civil, aucun autre écran. */
export default function WellnessSharePage({ token }) {
  const { t } = useTranslation();
  const [state, setState] = useState("loading"); // loading | ok | invalid | error
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchSharedWellness(token);
        if (alive) { setData(d); setState("ok"); }
      } catch (e) {
        if (alive) setState(/invalid_or_expired/.test(e?.message || "") ? "invalid" : "error");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const byId = useMemo(() => Object.fromEntries((data?.roster || []).map((p) => [p.id, p])), [data]);
  const rows = useMemo(() => data?.rows || [], [data]);
  const dates = useMemo(() => [...new Set(rows.map((r) => r.date))].sort().reverse(), [rows]);
  const today = todayISO();
  const selDate = dates.includes(today) ? today : (dates[0] || today);

  const model = useMemo(() => {
    if (!data) return null;
    return buildReportModel({ roster: data.roster || [], byId, rows, selDate, civilNames: {}, teamId: data.teamId, t });
  }, [data, byId, rows, selDate, t]);

  const onExport = async () => {
    if (!model || exporting) return;
    setExporting(true);
    try { await exportWellnessPptx(model, { t }); } catch { window.alert(t("staff.report.errExport")); }
    setExporting(false);
  };

  if (state === "loading") return <Shell><Center>{t("common.loading")}</Center></Shell>;
  if (state !== "ok" || !model) {
    return (
      <Shell>
        <Center>
          <AlertTriangle size={30} color={C.amb} />
          <div style={{ fontSize: 16, fontWeight: 800, margin: "12px 0 6px" }}>{t("share.invalidTitle")}</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: 360 }}>{t("share.invalidBody")}</div>
        </Center>
      </Shell>
    );
  }

  const fmt = (v) => (v == null ? "—" : v.toFixed(1));
  return (
    <Shell>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 16px 40px" }}>
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${C.blue}22`, border: `1px solid ${C.blue}55`, color: C.blue, borderRadius: 8, padding: "4px 9px", fontSize: 10.5, fontWeight: 800 }}>
            <Lock size={12} color={C.blue} /> {t("share.readOnly")}
          </span>
          <button onClick={onExport} disabled={exporting} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, background: exporting ? "rgba(255,255,255,0.08)" : `${C.coral}1c`, border: `1px solid ${C.coral}55`, borderRadius: 9, padding: "8px 11px", color: C.coral, fontSize: 12, fontWeight: 800, cursor: exporting ? "default" : "pointer" }}>
            <Download size={13} color={C.coral} /> {exporting ? t("staff.report.generating") : t("staff.report.exportBtn")}
          </button>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{clubLabel(data.teamId)}</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", textTransform: "capitalize", marginBottom: 16 }}>{model.dateLong}</div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
          <Kpi label={t("staff.wellness.kResponses")} value={`${model.kpis.responses}/${model.kpis.total}`} color="#fff" />
          <Kpi label={t("staff.wellness.kWellness")} value={fmt(model.kpis.wellness)} sub="/10" color={C.blue} />
          <Kpi label={t("staff.wellness.kRecovery")} value={fmt(model.kpis.recovery)} sub="/10" color={C.teal} />
          <Kpi label={t("staff.wellness.kWatch")} value={model.kpis.watch} color={model.kpis.watch > 0 ? C.amb : C.green} />
        </div>

        {/* Profil collectif */}
        <Card title={t("staff.wellness.profileTitle")}>
          {model.profile.map((p) => <Bar key={p.key} label={p.label} value={p.value} rpe={p.rpe} />)}
        </Card>

        {/* Répondants / manquants */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Card title={t("staff.wellness.respondedTitle")}>
            {model.responders.length === 0 ? <Empty text={t("staff.wellness.noResponses")} /> : model.responders.map((r, i) => (
              <Row key={i} left={`${r.name}${r.init ? "  " + r.init : ""}`} right={r.time} rightColor={C.teal} />
            ))}
          </Card>
          <Card title={t("staff.wellness.notRespondedTitle")}>
            {model.missing.length === 0
              ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.green, fontSize: 13, fontWeight: 700 }}><CheckCircle size={15} color={C.green} /> {t("staff.wellness.allResponded")}</div>
              : model.missing.map((m, i) => <Row key={i} left={`${m.name}${m.init ? "  " + m.init : ""}`} dot />)}
          </Card>
        </div>

        {/* À surveiller & remarques */}
        <Card title={t("staff.wellness.alertsTitle")}>
          {model.alerts.length === 0
            ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.green, fontSize: 12.5, fontWeight: 700 }}><CheckCircle size={15} color={C.green} /> {t("staff.wellness.noAlerts")}</div>
            : model.alerts.map((a, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${a.status === "alerte" ? C.coral : a.status === "vigilance" ? C.amb : C.green}`, paddingLeft: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                  {a.remark || t("staff.wellness.alertScores", { wellness: fmt(a.well), recovery: fmt(a.rec) })}
                </div>
              </div>
            ))}
        </Card>

        {/* Tendance 14 j */}
        <Card title={t("staff.wellness.trendTitle")} sub={t("staff.wellness.trendSub")}>
          {model.trend.map((d) => (
            <div key={d.date} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{d.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <MiniBar label={t("staff.wellness.mWellness")} value={d.well} color={C.blue} />
                <MiniBar label={t("staff.wellness.kRecovery")} value={d.rec} color={C.teal} />
              </div>
            </div>
          ))}
        </Card>

        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 16, lineHeight: 1.5 }}>{t("share.footer")}</div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div style={{ minHeight: "100vh", background: C.navy, color: "#fff", fontFamily: FONT }}>{children}</div>;
}
function Center({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>{children}</div>;
}
function Card({ title, sub, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: sub ? 2 : 12 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Kpi({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 14px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{sub || ""}</span></div>
    </div>
  );
}
function Bar({ label, value, rpe }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 10) * 100));
  const grad = rpe ? `linear-gradient(90deg, ${C.green}, ${C.amb} 60%, ${C.coral})` : `linear-gradient(90deg, ${C.green}, ${C.blue})`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 42px", alignItems: "center", gap: 10, marginBottom: 9 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{label}</span>
      <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: grad, borderRadius: 6 }} />
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
function Row({ left, right, rightColor, dot }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px", borderBottom: `1px solid ${C.border2}` }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 4, background: C.coral, flexShrink: 0 }} />}
      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
      {right && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: rightColor || "#fff", fontFamily: "ui-monospace,Menlo,monospace" }}>{right}</span>}
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 12.5, padding: "14px 8px" }}>{text}</div>;
}
