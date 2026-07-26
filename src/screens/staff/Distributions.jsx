import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { TrendingUp } from "../../lib/icons.jsx";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { TOP14_TESTS, datedResultsFor, withCurrentBodyweight, currentValueForTest } from "../../lib/top14.core.js";
import { useTestCampaigns } from "../../data/tests.js";
import { distribution, percentileOf } from "../../lib/distribution.js";

const accent = C.teal;
const fmt = (v) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2));
const clampPct = (v, min, max) => (max <= min ? 50 : Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)));

/* « Distributions » (staff) — PR-3 de la couche d'analyse. Situe un joueur par
   rapport à sa ligne / son équipe sur un test physique, SANS exposer la moindre
   valeur individuelle de coéquipier : on n'affiche que la forme agrégée (quantiles)
   d'un groupe ≥ 5 (k-anonymat) et le rang percentile du joueur sélectionné. */
export default function Distributions({ teamId, players = [] }) {
  const { t } = useTranslation();
  const { campaigns, results, loading } = useTestCampaigns(teamId);
  const [metricKey, setMetricKey] = useState(TOP14_TESTS[0].key);
  const [group, setGroup] = useState("team"); // team | avants | arrieres
  const [locateId, setLocateId] = useState("");

  const test = TOP14_TESTS.find((x) => x.key === metricKey) || TOP14_TESTS[0];

  // Valeur courante par joueur pour ce test (dernière mesure, poids courant).
  const valueByPlayer = useMemo(() => {
    const m = new Map();
    players.forEach((p) => {
      const v = currentValueForTest(test, withCurrentBodyweight(p, datedResultsFor(campaigns, results, p.id)));
      if (v != null) m.set(p.id, v);
    });
    return m;
  }, [players, campaigns, results, test]);

  const view = useMemo(() => {
    const gp = players.filter((p) => group === "team" || p.grp === group);
    const values = [], locatable = [];
    gp.forEach((p) => { const v = valueByPlayer.get(p.id); if (v != null) { values.push(v); locatable.push(p); } });
    return { values, dist: distribution(values), locatable };
  }, [players, group, valueByPlayer]);

  const locateVal = locateId ? valueByPlayer.get(locateId) : null;
  const pctl = locateVal != null ? percentileOf(locateVal, view.values, test.dir) : null;
  const unit = test.unit ? ` ${test.unit}` : "";

  const chip = (on) => ({ padding: "6px 10px", borderRadius: 8, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.05)", color: on ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" });
  const groups = [["team", t("staff.distributions.groupTeam")], ["avants", grpLabel("avants")], ["arrieres", grpLabel("arrieres")]];

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <TrendingUp size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("staff.distributions.title")}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 12 }}>{t("staff.distributions.hint")}</div>

      {/* Métrique */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {TOP14_TESTS.map((x) => <button key={x.key} onClick={() => setMetricKey(x.key)} style={chip(x.key === metricKey)}>{x.label}</button>)}
      </div>
      {/* Groupe */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {groups.map(([g, lbl]) => <button key={g} onClick={() => setGroup(g)} style={{ ...chip(g === group), flex: 1 }}>{lbl}</button>)}
      </div>
      {/* Situer un joueur */}
      <select value={locateId} onChange={(e) => setLocateId(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12.5, outline: "none", colorScheme: "dark", marginBottom: 12 }}>
        <option value="">{t("staff.distributions.locateNone")}</option>
        {view.locatable.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
      </select>

      {loading ? (
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("staff.distributions.loading")}</div>
      ) : view.dist.hidden ? (
        <div style={sc({ padding: 16, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 })}>{t("staff.distributions.kAnonHidden", { n: view.dist.n })}</div>
      ) : (
        <div style={sc({ padding: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: accent }}>{fmt(view.dist.median)}{unit}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("staff.distributions.median")} · {t("staff.distributions.nPlayers", { n: view.dist.n })}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>
            {t("staff.distributions.iqr")} {fmt(view.dist.q1)} – {fmt(view.dist.q3)}{unit} · {t("staff.distributions.range")} {fmt(view.dist.min)} – {fmt(view.dist.max)}{unit}
          </div>

          {/* Boîte Q1–Q3 + médiane + repère joueur */}
          <div style={{ position: "relative", height: 40, marginBottom: 6 }}>
            <div style={{ position: "absolute", top: 18, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
            <div style={{ position: "absolute", top: 14, height: 12, borderRadius: 3, background: `${accent}33`, border: `1px solid ${accent}88`, left: `${clampPct(view.dist.q1, view.dist.min, view.dist.max)}%`, right: `${100 - clampPct(view.dist.q3, view.dist.min, view.dist.max)}%` }} />
            <div style={{ position: "absolute", top: 10, width: 2, height: 20, background: accent, left: `${clampPct(view.dist.median, view.dist.min, view.dist.max)}%` }} />
            {locateVal != null && (
              <div style={{ position: "absolute", top: 12, left: `${clampPct(locateVal, view.dist.min, view.dist.max)}%`, transform: "translateX(-50%)" }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: C.amb, border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(0,0,0,0.3)" }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}>
            <span>{fmt(view.dist.min)}{unit}</span>
            <span>{test.dir === "down" ? t("staff.distributions.dirDownHint") : t("staff.distributions.dirUpHint")}</span>
            <span>{fmt(view.dist.max)}{unit}</span>
          </div>

          {locateVal != null && pctl != null && (
            <div style={{ marginTop: 14, padding: "9px 11px", borderRadius: 10, background: `${C.amb}14`, border: `1px solid ${C.amb}44`, fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 800, color: C.amb }}>{fmt(locateVal)}{unit}</span> · {t("staff.distributions.betterThan", { pct: pctl })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
