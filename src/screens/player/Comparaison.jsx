import { useMemo, useState } from "react";
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
   des coéquipiers. */
export default function Comparaison({ me }) {
  const { campaigns, results, loading } = useTestCampaigns(me.team);
  const lineStats = useLineStats(me.id);
  const teamStats = useTeamStats(me.id);
  const [scope, setScope] = useState("team"); // "team" | "line"

  const A = useMemo(() => analyzeProfile(me, campaigns, results, "Toi"), [me, campaigns, results]);
  const lineLabel = `Moyenne ${grpLabel(me.grp)?.toLowerCase() || "ligne"}`;
  const B = useMemo(
    () => (scope === "team" ? profileFromStats("Moyenne équipe", teamStats) : profileFromStats(lineLabel, lineStats)),
    [scope, teamStats, lineStats, lineLabel],
  );

  const hasMine = A && Object.values(A.byTest).some((e) => e.value != null);
  const tab = (key, label) => (
    <button key={key} onClick={() => setScope(key)} style={{ flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 800,
      background: scope === key ? C.viol : "rgba(255,255,255,0.06)", border: `1px solid ${scope === key ? C.viol : C.border}`, color: scope === key ? "#fff" : "rgba(255,255,255,0.7)" }}>{label}</button>
  );

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Activity size={18} color={C.viol} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>Où je me situe ?</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 12, lineHeight: 1.5 }}>
        Tes valeurs par test comparées à la moyenne de ton équipe ou de ta ligne, avec le repère Top 14. Seules des moyennes sont affichées — jamais les valeurs d'un coéquipier.
      </div>

      {/* Choix du comparatif B */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {tab("team", "Moyenne équipe")}
        {tab("line", `Moyenne ${grpLabel(me.grp)?.toLowerCase() || "ligne"}`)}
      </div>

      {loading && !hasMine ? (
        <div style={sc({ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 })}>Chargement de tes tests…</div>
      ) : !hasMine ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          Aucun test enregistré pour l'instant.<br />Tes résultats apparaîtront ici après ta prochaine évaluation physique.
        </div>
      ) : (
        <CompareView A={A} B={B} />
      )}
    </section>
  );
}
