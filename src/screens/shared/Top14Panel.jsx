import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section } from "../../lib/ui.jsx";
import { TOP14_TESTS, catLabel } from "../../lib/top14.js";

const secToMMSS = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const isPdc = (k) => k === "squat" || k === "bench" || k === "deadlift" || k === "tractions";

// Valeur affichée (joueur ou seuil) selon le test.
const fmt = (test, v) => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (test.key === "bronco") return secToMMSS(v);
  if (isPdc(test.key)) return `${test.key === "tractions" ? "+" : ""}${v.toFixed(2)}`;
  return `${Math.round(v)}${test.unit ? test.unit : ""}`;
};

/* Comparaison du joueur aux normes Top 14 de son poste (lecture seule).
   `t14` = sortie de top14Player(pos, datedResults). Jauge « % du niveau Top 14 »
   + badge TOP 14 sur les tests atteints. */
export default function Top14Panel({ t14 }) {
  const { t } = useTranslation();
  if (!t14) return null;
  if (!t14.cat) {
    return (
      <Section title={t("shared.top14.title")}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t("shared.top14.posUnknown")}</div>
      </Section>
    );
  }
  const count = t14.count || 0;
  return (
    <Section
      title={t("shared.top14.title")}
      right={<span style={{ fontSize: 9.5, fontWeight: 800, color: count ? C.amb : "rgba(255,255,255,0.5)" }}>{catLabel(t14.cat)} · {count > 0 ? `🏆 ×${count}` : t("shared.top14.noTest")}</span>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TOP14_TESTS.map((t) => {
          const b = t14.byTest[t.key] || {};
          const done = !!b.everValid;
          const pct = b.pct != null ? Math.max(0, Math.min(140, b.pct)) : null;
          const barW = pct != null ? Math.min(100, pct) : 0;
          const barC = done ? C.green : pct == null ? "rgba(255,255,255,0.2)" : pct >= 90 ? C.amb : C.coral;
          return (
            <div key={t.key} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{t.label} {t.unit ? <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{t.unit}</span> : null}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{fmt(t, b.value)}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>/ {fmt(t, b.threshold)}</span>
                {done && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.3, color: "#0c2b2b", background: C.amb, borderRadius: 5, padding: "1px 5px" }}>TOP 14</span>}{/* i18n-ok: nom de ligue */}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: 6, width: `${barW}%`, background: barC, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: barC, width: 42, textAlign: "right" }}>{pct != null ? `${Math.round(pct)}%` : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginTop: 8, lineHeight: 1.5 }}>
        {t("shared.top14.footer")}
      </div>
    </Section>
  );
}
