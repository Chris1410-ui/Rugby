import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { TrendingUp } from "../../lib/icons.jsx";
import { grpLabel } from "../../lib/positions.js";
import { TOP14_TESTS } from "../../lib/top14.core.js";
import { useTestDistribution } from "../../data/tests.js";

const fmt = (v) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2));
const clampPct = (v, min, max) => (max <= min ? 50 : Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)));

/* « Distributions » (joueur) — te situe par rapport à ta ligne / ton équipe sur un
   test physique. Les agrégats (quartiles) viennent d'un RPC k-anon serveur : tu ne
   vois JAMAIS les valeurs individuelles de tes coéquipiers, seulement la forme du
   groupe (≥ 5 joueurs) et ton propre rang. Ta valeur reste toujours visible. */
export default function Distributions({ me, accent = C.green }) {
  const { t } = useTranslation();
  const [metricKey, setMetricKey] = useState(TOP14_TESTS[0].key);
  const [scope, setScope] = useState(me?.grp ? "line" : "team");
  const { dist, loading } = useTestDistribution(me?.id, metricKey, scope);

  const test = TOP14_TESTS.find((x) => x.key === metricKey) || TOP14_TESTS[0];
  const unit = test.unit ? ` ${test.unit}` : "";
  const groupLabel = scope === "line" ? grpLabel(me?.grp) : t("player.dist.team");

  const chip = (on) => ({ padding: "6px 10px", borderRadius: 8, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.05)", color: on ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" });
  const shown = dist && !dist.hidden && dist.min != null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <TrendingUp size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("player.dist.title")}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 12 }}>{t("player.dist.hint")}</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {TOP14_TESTS.map((x) => <button key={x.key} onClick={() => setMetricKey(x.key)} style={chip(x.key === metricKey)}>{x.label}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {me?.grp && <button onClick={() => setScope("line")} style={{ ...chip(scope === "line"), flex: 1 }}>{grpLabel(me.grp)}</button>}
        <button onClick={() => setScope("team")} style={{ ...chip(scope === "team"), flex: 1 }}>{t("player.dist.team")}</button>
      </div>

      {loading ? (
        <div style={sc({ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("player.dist.loading")}</div>
      ) : (
        <div style={sc({ padding: 16 })}>
          {shown ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: accent }}>{fmt(dist.median)}{unit}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("player.dist.median", { group: groupLabel })} · {t("player.dist.nPlayers", { n: dist.n })}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>
                {t("player.dist.iqr")} {fmt(dist.q1)} – {fmt(dist.q3)}{unit} · {t("player.dist.range")} {fmt(dist.min)} – {fmt(dist.max)}{unit}
              </div>

              <div style={{ position: "relative", height: 40, marginBottom: 6 }}>
                <div style={{ position: "absolute", top: 18, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
                <div style={{ position: "absolute", top: 14, height: 12, borderRadius: 3, background: `${accent}33`, border: `1px solid ${accent}88`, left: `${clampPct(dist.q1, dist.min, dist.max)}%`, right: `${100 - clampPct(dist.q3, dist.min, dist.max)}%` }} />
                <div style={{ position: "absolute", top: 10, width: 2, height: 20, background: accent, left: `${clampPct(dist.median, dist.min, dist.max)}%` }} />
                {dist.myVal != null && (
                  <div style={{ position: "absolute", top: 12, left: `${clampPct(dist.myVal, dist.min, dist.max)}%`, transform: "translateX(-50%)" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 7, background: C.amb, border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(0,0,0,0.3)" }} />
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}>
                <span>{fmt(dist.min)}{unit}</span>
                <span>{test.dir === "down" ? t("player.dist.dirDownHint") : t("player.dist.dirUpHint")}</span>
                <span>{fmt(dist.max)}{unit}</span>
              </div>

              {dist.myVal != null && dist.myPct != null ? (
                <div style={{ marginTop: 14, padding: "9px 11px", borderRadius: 10, background: `${C.amb}14`, border: `1px solid ${C.amb}44`, fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 800, color: C.amb }}>{fmt(dist.myVal)}{unit}</span> · {t("player.dist.betterThan", { pct: dist.myPct, group: groupLabel })}
                </div>
              ) : (
                <div style={{ marginTop: 14, fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>{t("player.dist.noMyValue")}</div>
              )}
            </>
          ) : dist && dist.hidden && dist.n > 0 ? (
            // Groupe présent mais < 5 mesures → k-anon : message EXPLICITE (pas
            // « tu n'as pas de mesure »), avec ta valeur si elle existe.
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
              {dist.myVal != null && <div style={{ fontSize: 20, fontWeight: 900, color: accent, marginBottom: 4 }}>{fmt(dist.myVal)}{unit}</div>}
              {t("player.dist.kAnonHidden", { n: dist.n })}
            </div>
          ) : dist?.myVal != null ? (
            // Ta valeur existe mais aucune distribution de groupe disponible.
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: accent, marginBottom: 4 }}>{fmt(dist.myVal)}{unit}</div>
              {t("player.dist.soloValue")}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{t("player.dist.noMyValue")}</div>
          )}
        </div>
      )}
    </div>
  );
}
