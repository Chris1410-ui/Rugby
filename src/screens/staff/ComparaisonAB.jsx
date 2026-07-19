import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { useTestCampaigns } from "../../data/tests.js";
import { analyzeProfile, averageProfileClient } from "../../lib/compare.js";
import { Activity } from "../../lib/icons.jsx";
import CompareView from "../shared/CompareView.jsx";

const B_TEAM = "__team__", B_LINE = "__line__";
const A_COL = C.green, B_COL = C.viol;

/* Comparaison A/B (staff) : deux joueurs (ou un joueur vs moyenne équipe/ligne)
   côte à côte sur les 9 tests. Le staff lit tous les résultats de l'équipe (RLS)
   → moyennes calculées côté client. Le rendu (tableau/barres/radar) est délégué à
   CompareView, partagé avec la vue joueur. */
export default function ComparaisonAB({ teamId, players }) {
  const { t } = useTranslation();
  const { campaigns, results } = useTestCampaigns(teamId);
  const roster = useMemo(
    () => [...players].sort((a, b) => displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base" })),
    [players],
  );
  const realPlayers = useMemo(() => players.filter((p) => !p.isDemo), [players]);
  const [aId, setAId] = useState(roster[0]?.id || "");
  const [bId, setBId] = useState(B_TEAM);

  const A = useMemo(() => analyzeProfile(roster.find((p) => p.id === aId), campaigns, results), [roster, aId, campaigns, results]);
  const B = useMemo(() => {
    if (bId === B_TEAM) return averageProfileClient(realPlayers, campaigns, results, t("compare.teamAvg"));
    if (bId === B_LINE) {
      const grp = A?.player?.grp;
      return averageProfileClient(realPlayers.filter((p) => p.grp === grp), campaigns, results, t("compare.lineAvg", { line: grpLabel(grp)?.toLowerCase() || "ligne" }));
    }
    return analyzeProfile(roster.find((p) => p.id === bId), campaigns, results);
  }, [bId, roster, realPlayers, campaigns, results, A, t]);

  const bIsAvg = bId === B_TEAM || bId === B_LINE;
  const swap = () => { if (bIsAvg) return; setAId(bId); setBId(aId); };
  const sel = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none" };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Activity size={18} color={C.coral} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("compare.staff.title")}</div>
      </div>

      {/* Sélecteurs A ⇄ B */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <select value={aId} onChange={(e) => setAId(e.target.value)} style={{ ...sel, borderColor: `${A_COL}88` }}>
          {roster.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
        </select>
        <button onClick={swap} disabled={bIsAvg} title={bIsAvg ? t("compare.staff.swapDisabled") : t("compare.staff.swap")} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: bIsAvg ? "default" : "pointer", flexShrink: 0, opacity: bIsAvg ? 0.4 : 1 }}>⇄</button>
        <select value={bId} onChange={(e) => setBId(e.target.value)} style={{ ...sel, borderColor: `${B_COL}88` }}>
          <optgroup label={t("compare.staff.groupAverages")}>
            <option value={B_TEAM}>{t("compare.teamAvg")}</option>
            <option value={B_LINE}>{t("compare.staff.lineOfA")}</option>
          </optgroup>
          <optgroup label={t("compare.staff.groupPlayers")}>
            {roster.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </optgroup>
        </select>
      </div>

      <CompareView A={A} B={B} />
    </section>
  );
}
