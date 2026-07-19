import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { Activity } from "../../lib/icons.jsx";
import { useTestCampaigns, useLineStats, useTeamStats } from "../../data/tests.js";
import { analyzeProfile, profileFromStats } from "../../lib/compare.js";
import CompareView from "../shared/CompareView.jsx";

/* Comparaison joueur — MÊME tableau/barres/radar que le staff (CompareView).
   A = « Toi » (mes résultats). B = moyenne ÉQUIPE ou moyenne LIGNE, au choix.
   Confidentialité : mes valeurs viennent de mes résultats ; les moyennes de
   fonctions SECURITY DEFINER (agrégats + % Top 14) — jamais les valeurs brutes
   des coéquipiers. Textes via i18n (namespace `compare`). */
export default function Comparaison({ me }) {
  const { t } = useTranslation();
  const { campaigns, results, loading } = useTestCampaigns(me.team);
  const lineStats = useLineStats(me.id);
  const teamStats = useTeamStats(me.id);
  const [scope, setScope] = useState("team"); // "team" | "line"

  const lineName = grpLabel(me.grp)?.toLowerCase() || "ligne";
  const A = useMemo(() => analyzeProfile(me, campaigns, results, t("compare.you")), [me, campaigns, results, t]);
  const B = useMemo(
    () => (scope === "team"
      ? profileFromStats(t("compare.teamAvg"), teamStats)
      : profileFromStats(t("compare.lineAvg", { line: lineName }), lineStats)),
    [scope, teamStats, lineStats, lineName, t],
  );

  const hasMine = A && Object.values(A.byTest).some((e) => e.value != null);
  const tab = (k, label) => (
    <button key={k} onClick={() => setScope(k)} style={{ flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 800,
      background: scope === k ? C.viol : "rgba(255,255,255,0.06)", border: `1px solid ${scope === k ? C.viol : C.border}`, color: scope === k ? "#fff" : "rgba(255,255,255,0.7)" }}>{label}</button>
  );

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Activity size={18} color={C.viol} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("compare.player.title")}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 12, lineHeight: 1.5 }}>{t("compare.player.intro")}</div>

      {/* Choix du comparatif B */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {tab("team", t("compare.teamAvg"))}
        {tab("line", t("compare.lineAvg", { line: lineName }))}
      </div>

      {loading && !hasMine ? (
        <div style={sc({ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 })}>{t("compare.player.loading")}</div>
      ) : !hasMine ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          {t("compare.player.noTestTitle")}<br />{t("compare.player.noTestBody")}
        </div>
      ) : (
        <CompareView A={A} B={B} />
      )}
    </section>
  );
}
