import { useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { wbToWellness, computeReadiness, isoDate, parseISO, fmtShort, todayISO, EVENING_MARKERS } from "../../lib/metrics.js";
import { Section, KPI } from "../../lib/ui.jsx";
import { useTeamCheckinHistory } from "../../data/checkins.js";
import { activeCamp } from "../../data/camps.js";
import { MultiLine, Bars, Donut, Heatmap } from "../../lib/charts.jsx";

const zoneOfReadiness = (v) => (v == null ? null : v > 70 ? "green" : v > 50 ? "amber" : "red");
const ZONE_C = { green: C.green, amber: C.amb, red: C.coral };
const readyColor = (v) => (v == null ? "rgba(255,255,255,0.06)" : ZONE_C[zoneOfReadiness(v)]);
const daysBetween = (fromIso) => Math.max(1, Math.round((Date.now() - parseISO(fromIso).getTime()) / 864e5));

/* Historique des bilans — vue analytique (staff). Filtres + graphiques dérivés
   des bilans (wbToWellness / computeReadiness — source unique, aucun nouveau
   calcul). Readiness historique = wellness du jour + risque courant (approx). */
export default function Historique({ players, testCampaigns = [], camps = [] }) {
  const [scope, setScope] = useState("all"); // all | <grp> | <playerId>
  const [period, setPeriod] = useState("30"); // 7 | 30 | camp | all | custom
  const [custom, setCustom] = useState({ debut: isoDate(new Date(Date.now() - 30 * 864e5)), fin: todayISO() });
  const [barMetric, setBarMetric] = useState("wellness"); // wellness | readiness | sleep

  const grps = [...new Set(players.map((p) => p.grp).filter(Boolean))];
  // « Depuis le camp » = le camp actif (période nommée). Repli : la campagne de
  // tests la plus récente si aucun camp n'existe encore.
  const camp = activeCamp(camps);
  const lastCamp = [...testCampaigns].sort((a, b) => b.date.localeCompare(a.date))[0];
  const campFrom = camp?.dateDebut || lastCamp?.date || null;
  const days = period === "7" ? 7 : period === "30" ? 30 : period === "camp" ? (campFrom ? daysBetween(campFrom) : 30) : 3650;

  // Fenêtre [fromISO, toISO] appliquée à TOUS les graphiques + à l'en-tête « Au … ».
  // Presets : se terminent aujourd'hui. Personnalisé : bornes début/fin choisies.
  const toISO = period === "custom" ? custom.fin : todayISO();
  const fromISO = period === "custom" ? custom.debut : isoDate(new Date(Date.now() - (days - 1) * 864e5));
  // On élargit juste la requête pour couvrir le début choisi (même requête
  // daily_checkins ; l'axe restreint ensuite à date >= début ET date <= fin).
  const fetchDays = period === "custom" ? Math.max(1, daysBetween(custom.debut)) : days;

  const allIds = players.map((p) => p.id);
  const { rows, loading } = useTeamCheckinHistory(allIds, fetchDays);
  const playerById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const filtered = scope === "all" ? players : grps.includes(scope) ? players.filter((p) => p.grp === scope) : players.filter((p) => p.id === scope);
  const fIds = new Set(filtered.map((p) => p.id));

  // Axe de dates de la fenêtre choisie (borné à 60 j pour la lisibilité).
  // Arithmétique calendaire (setDate) → robuste aux changements d'heure.
  const dateAxis = useMemo(() => {
    const end = parseISO(toISO);
    const full = [];
    for (let d = parseISO(fromISO); d <= end && full.length < 4000; d.setDate(d.getDate() + 1)) full.push(isoDate(d));
    return full.slice(-60);
  }, [fromISO, toISO]);

  // Sépare matin (readiness/bien-être — formule inchangée) et soir (ressenti).
  const matinRows = useMemo(() => rows.filter((r) => r.moment !== "soir"), [rows]);
  const soirRows = useMemo(() => rows.filter((r) => r.moment === "soir"), [rows]);

  // hist[pid][date] = { wellness, sleepH } — MATIN uniquement.
  const hist = useMemo(() => {
    const m = {};
    matinRows.forEach((r) => {
      const w = wbToWellness(r.wb, r.sleepH);
      (m[r.playerId] = m[r.playerId] || {})[r.date] = { wellness: w, sleepH: r.sleepH };
    });
    return m;
  }, [matinRows]);

  // soirHist[pid][date] = moyenne des 6 marqueurs du soir (/10).
  const soirHist = useMemo(() => {
    const m = {};
    soirRows.forEach((r) => {
      const vals = EVENING_MARKERS.map((k) => r.wb?.[k.k]).filter((v) => typeof v === "number");
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      (m[r.playerId] = m[r.playerId] || {})[r.date] = avg;
    });
    return m;
  }, [soirRows]);

  const readinessAt = (pid, date) => {
    const c = hist[pid]?.[date];
    if (!c || c.wellness == null) return null;
    return computeReadiness(c.wellness, playerById[pid]?.risque ?? 30, c.sleepH);
  };

  // Séries de tendance (moyenne équipe filtrée par jour).
  const series = useMemo(() => {
    const avg = (fn) => dateAxis.map((d) => {
      const vals = filtered.map((p) => fn(p.id, d)).filter((v) => v != null && Number.isFinite(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    const chargeByDate = dateAxis.map((d) => {
      const vals = filtered.map((p) => (p._load?.hist || []).find((h) => h.date === d)?.au).filter((v) => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return {
      readiness: avg((pid, d) => readinessAt(pid, d)),
      wellness: avg((pid, d) => hist[pid]?.[d]?.wellness),
      sleep: avg((pid, d) => hist[pid]?.[d]?.sleepH),
      soir: avg((pid, d) => soirHist[pid]?.[d]),
      charge: chargeByDate,
    };
  }, [dateAxis, filtered, hist, soirHist]); // eslint-disable-line react-hooks/exhaustive-deps

  const axisLabels = dateAxis.map((d) => fmtShort(d).replace(/\.$/, ""));

  // Dernière date avec au moins un bilan (pour barres / donut / complétion).
  const refDate = useMemo(() => {
    for (let i = dateAxis.length - 1; i >= 0; i--) { const d = dateAxis[i]; if (filtered.some((p) => hist[p.id]?.[d])) return d; }
    return todayISO();
  }, [dateAxis, filtered, hist]);

  const barVal = (p) => barMetric === "sleep" ? hist[p.id]?.[refDate]?.sleepH : barMetric === "readiness" ? readinessAt(p.id, refDate) : hist[p.id]?.[refDate]?.wellness;
  const barData = filtered.map((p) => { const v = barVal(p); return { label: p.name, value: v == null ? null : Math.round(v), color: barMetric === "readiness" ? readyColor(v) : C.blue }; })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const barUnit = barMetric === "sleep" ? "h" : barMetric === "wellness" ? "" : "";
  const barMax = barMetric === "sleep" ? 12 : barMetric === "readiness" ? 100 : 50;

  // Donut zones readiness (à refDate) + complétion.
  const zoneCounts = { green: 0, amber: 0, red: 0, none: 0 };
  filtered.forEach((p) => { const z = zoneOfReadiness(readinessAt(p.id, refDate)); zoneCounts[z || "none"]++; });
  const donutSlices = [
    { label: "Zone verte", value: zoneCounts.green, color: C.green },
    { label: "Ambre", value: zoneCounts.amber, color: C.amb },
    { label: "Rouge", value: zoneCounts.red, color: C.coral },
  ];
  const filledRef = filtered.filter((p) => hist[p.id]?.[refDate]).length;
  const completion = filtered.length ? Math.round((filledRef / filtered.length) * 100) : 0;

  // Heatmap joueurs × jours (readiness).
  const heatCols = dateAxis.slice(-Math.min(dateAxis.length, 42));
  const heatRows = filtered.slice(0, 30).map((p) => ({
    label: p.name,
    cells: heatCols.map((d) => { const v = readinessAt(p.id, d); return { v, color: readyColor(v) }; }),
  }));

  const btn = (active) => ({ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: active ? C.coral : "rgba(255,255,255,0.07)", color: "#fff", whiteSpace: "nowrap" });
  const dateInp = { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 9px", color: "#fff", fontSize: 12, outline: "none", colorScheme: "dark" };

  return (
    <section>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Historique des bilans</div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button onClick={() => setScope("all")} style={btn(scope === "all")}>Équipe</button>
        {grps.map((g) => <button key={g} onClick={() => setScope(g)} style={btn(scope === g)}>{grpLabel(g)}</button>)}
        <select value={fIds.size === 1 && !grps.includes(scope) && scope !== "all" ? scope : ""} onChange={(e) => e.target.value && setScope(e.target.value)} style={{ ...btn(false), background: "rgba(255,255,255,0.07)", appearance: "auto", colorScheme: "dark" }}>
          <option value="">Un joueur…</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: period === "custom" ? 8 : 14 }}>
        {[["7", "7 jours"], ["30", "30 jours"], ["camp", "Depuis le camp"], ["all", "Tout"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={btn(period === v)} disabled={v === "camp" && !campFrom} title={v === "camp" && camp ? camp.nom : undefined}>{l}</button>
        ))}
        <button onClick={() => setPeriod("custom")} style={btn(period === "custom")}>Personnalisé</button>
      </div>
      {period === "custom" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>du</span>
          <input type="date" value={custom.debut} max={custom.fin} onChange={(e) => setCustom((c) => ({ ...c, debut: e.target.value }))} style={dateInp} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>au</span>
          <input type="date" value={custom.fin} min={custom.debut} max={todayISO()} onChange={(e) => setCustom((c) => ({ ...c, fin: e.target.value }))} style={dateInp} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        <KPI label="BILANS (RÉF.)" value={`${filledRef}/${filtered.length}`} sub={fmtShort(refDate)} color={C.viol} />
        <KPI label="COMPLÉTION" value={`${completion}%`} color={completion > 80 ? C.green : completion > 50 ? C.amb : C.coral} />
        <KPI label="JOUEURS" value={filtered.length} color={C.blue} />
      </div>

      {loading && rows.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.55)", fontSize: 12 })}>Chargement de l'historique…</div>
      ) : (
        <>
          <Section title="TENDANCES (MOYENNE)">
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>☀️ Matin — Readiness /100 · Bien-être /50 · Sommeil (h) &nbsp;·&nbsp; 🌙 Soir — Ressenti /10</div>
            <MultiLine
              labels={axisLabels}
              series={[
                { name: "Readiness", color: C.green, pts: series.readiness },
                { name: "Bien-être", color: C.blue, pts: series.wellness },
                { name: "Sommeil", color: C.viol, pts: series.sleep },
                { name: "Ressenti soir", color: C.amb, pts: series.soir },
              ]}
            />
          </Section>

          <Section title="CHARGE MOYENNE (UA / JOUR)">
            <MultiLine labels={axisLabels} series={[{ name: "Charge (UA)", color: C.coral, pts: series.charge }]} height={120} />
          </Section>

          <Section title="COMPARAISON JOUEURS" right={
            <div style={{ display: "flex", gap: 4 }}>
              {[["wellness", "Bien-être"], ["readiness", "Readiness"], ["sleep", "Sommeil"]].map(([v, l]) => (
                <button key={v} onClick={() => setBarMetric(v)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", fontSize: 9.5, fontWeight: 700, cursor: "pointer", background: barMetric === v ? C.coral : "rgba(255,255,255,0.08)", color: "#fff" }}>{l}</button>
              ))}
            </div>
          }>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Au {fmtShort(refDate)}</div>
            {barData.length ? <Bars data={barData} unit={barUnit} max={barMax} /> : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Aucune donnée.</div>}
          </Section>

          <Section title="RÉPARTITION READINESS">
            <Donut slices={donutSlices} centerLabel={`${completion}%`} />
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 6 }}>Zones au {fmtShort(refDate)} · centre = complétion des bilans</div>
          </Section>

          <Section title="HEATMAP READINESS (JOUEURS × JOURS)">
            {heatRows.length ? <Heatmap rows={heatRows} colLabels={heatCols.map((d) => fmtShort(d).replace(/\.$/, ""))} /> : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Aucune donnée.</div>}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, fontSize: 9.5, color: "rgba(255,255,255,0.6)" }}>
              <span>🟩 &gt; 70</span><span>🟧 51–70</span><span>🟥 ≤ 50</span><span style={{ color: "rgba(255,255,255,0.35)" }}>▫︎ pas de bilan</span>
            </div>
          </Section>
        </>
      )}
    </section>
  );
}
