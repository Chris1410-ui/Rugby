import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section, KPI, Tag } from "../../lib/ui.jsx";
import { fmtShort, todayISO } from "../../lib/metrics.js";
import { MultiLine, Bars } from "../../lib/charts.jsx";
import { useGpsSessions, fetchGpsAggregates } from "../../data/gps.js";
import { gpsRecords, gpsSeries, gpsWindowLoad, gpsPlayerAgg, heatmapsOf } from "../../lib/gps.js";
import HeatmapsGallery from "./HeatmapsGallery.jsx";

/* Section GPS de la Fiche (GPS-4) — charge EXTERNE, lecture staff + joueur (RLS).
   Records (vmax phare), courbes d'évolution, comparaison k-anon ligne/équipe
   (self uniquement, RPC calées sur l'appelant), juxtaposition charge externe/
   interne (SANS métrique combinée : fusion différée), historique compact.
   Aucune formule existante (sRPE/ACWR/points) n'est modifiée. */

const CHART_METRICS = [
  { key: "distance_m", color: C.blue },
  { key: "hsr_m", color: C.coral },
  { key: "vmax_kmh", color: C.teal },
  { key: "m_per_min", color: C.viol },
];

export default function GpsFicheSection({ player, self = false }) {
  const { t } = useTranslation();
  const { sessions } = useGpsSessions(player?.id);
  const [agg, setAgg] = useState(null);
  const [heatOpen, setHeatOpen] = useState(false);

  useEffect(() => {
    // Comparaison k-anon : seulement en self (les RPC sont calées sur my_player_id).
    if (!self || !sessions.length) { setAgg(null); return; }
    let alive = true;
    fetchGpsAggregates(90).then((a) => { if (alive) setAgg(a); });
    return () => { alive = false; };
  }, [self, sessions.length]);

  const records = useMemo(() => gpsRecords(sessions), [sessions]);
  const playerAgg = useMemo(() => gpsPlayerAgg(sessions), [sessions]);
  const ext7 = useMemo(() => gpsWindowLoad(sessions, 7, todayISO()), [sessions]);

  if (!sessions.length) return null;

  const rec = (key) => records[key];
  const recSub = (key) => (rec(key)?.date ? fmtShort(rec(key).date) : "—");
  const metricLabel = (k) => t(`shared.fiche.gps.m_${k}`);
  const hasHeatmaps = sessions.some((g) => heatmapsOf(g).length);

  // Une métrique n'est comparée que si la ligne OU l'équipe passe le seuil (≥5).
  const compareRows = agg
    ? CHART_METRICS.map(({ key }) => ({ key, line: agg.line?.[key], team: agg.team?.[key], you: playerAgg[key] }))
        .filter((r) => (r.line || r.team) && r.you != null)
    : [];

  return (
    <Section title={`📡 ${t("shared.fiche.gps.title")}`}>
      {/* Accès aux heatmaps conservées (fiche individuelle : noms autorisés). */}
      {hasHeatmaps && (
        <button onClick={() => setHeatOpen(true)} style={{ width: "100%", marginBottom: 12, background: `${C.teal}14`, border: `1px solid ${C.teal}44`, borderRadius: 10, padding: 10, color: C.teal, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
          🗺️ {t("gps.heatmaps.title")}
        </button>
      )}
      {heatOpen && <HeatmapsGallery playerId={player.id} showNames onClose={() => setHeatOpen(false)} />}

      {/* Records (charge externe) — vmax en tête, comme un record suivi. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <KPI label={t("shared.fiche.gps.recVmax")} value={rec("vmax_kmh") ? `${rec("vmax_kmh").value}` : "—"} sub={rec("vmax_kmh") ? `km/h · ${recSub("vmax_kmh")}` : "—"} color={C.teal} />{/* i18n-ok: unité km/h */}
        <KPI label={t("shared.fiche.gps.recDistance")} value={rec("distance_m") ? `${rec("distance_m").value}` : "—"} sub={rec("distance_m") ? `m · ${recSub("distance_m")}` : "—"} />{/* i18n-ok: unité m */}
        <KPI label={t("shared.fiche.gps.recHsr")} value={rec("hsr_m") ? `${rec("hsr_m").value}` : "—"} sub={rec("hsr_m") ? `m · ${recSub("hsr_m")}` : "—"} />{/* i18n-ok: unité m */}
        <KPI label={t("shared.fiche.gps.recMmin")} value={rec("m_per_min") ? `${rec("m_per_min").value}` : "—"} sub={rec("m_per_min") ? `m/min · ${recSub("m_per_min")}` : "—"} />{/* i18n-ok: unité m/min */}
      </div>

      {/* Courbes d'évolution (4 mini-graphes). */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {CHART_METRICS.map(({ key, color }) => {
          const serie = gpsSeries(sessions, key);
          if (serie.length < 2) return null;
          return (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{metricLabel(key)}</div>
              <MultiLine height={90} labels={serie.map((p) => fmtShort(p.date))} series={[{ name: metricLabel(key), color, pts: serie.map((p) => p.value) }]} />
            </div>
          );
        })}
      </div>

      {/* Comparaison k-anon (self uniquement). */}
      {self && (
        compareRows.length > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 6 }}>{t("shared.fiche.gps.compareTitle")}</div>
            {compareRows.map((r) => (
              <div key={r.key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>{metricLabel(r.key)}</div>
                <Bars data={[
                  { label: t("shared.fiche.gps.you"), value: r.you, color: C.teal },
                  { label: t("shared.fiche.gps.line"), value: r.line?.avg ?? null, color: C.blue },
                  { label: t("shared.fiche.gps.team"), value: r.team?.avg ?? null, color: C.viol },
                ]} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>{t("shared.fiche.gps.needFive")}</div>
        )
      )}

      {/* Charge externe (GPS) ⟷ charge interne (sRPE/ACWR) — juxtaposition seule. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: `${C.teal}12`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: 11 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.teal, letterSpacing: 0.5, marginBottom: 6 }}>{t("shared.fiche.gps.extLoad")}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
            <div>{t("shared.fiche.gps.ext7dSessions", { count: ext7.n })}</div>
            <div>{t("shared.fiche.gps.ext7dDistance", { km: (ext7.distanceM / 1000).toFixed(1) })}</div>
            <div>{t("shared.fiche.gps.ext7dHsr", { m: ext7.hsrM })}</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 11 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, marginBottom: 6 }}>{t("shared.fiche.gps.intLoad")}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{Number(player?.acwr ?? 0).toFixed(2)}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}> ACWR</span></div>{/* i18n-ok: sigle ACWR */}
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>{t("shared.fiche.gps.combineSoon")}</div>
        </div>
      </div>

      {/* Historique compact (Fiche individuelle : session_name privé autorisé ici). */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 6 }}>{t("shared.fiche.gps.historyTitle")}</div>
        {sessions.slice(0, 8).map((g) => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.sessionName || fmtShort(g.date)}</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{[fmtShort(g.date), g.distanceM != null ? `${g.distanceM} m` : null, g.vmaxKmh != null ? `${g.vmaxKmh} km/h` : null].filter(Boolean).join(" · ")}</div>
            </div>
            {g.source !== "manual" && <Tag c={C.teal}>{t("player.gps.aiTag")}</Tag>}
          </div>
        ))}
      </div>
    </Section>
  );
}
