import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { TrendingUp, ChevronDown } from "../../lib/icons.jsx";
import { fmtShort } from "../../lib/metrics.js";
import { usePrograms } from "../../data/programs.js";
import { useTeamExercisePerf } from "../../data/exercisePerf.js";
import { programEfficacy, EFFICACY } from "../../lib/protocolEfficacy.js";

const accent = C.teal;
const deltaColor = (d) => (d == null ? "rgba(255,255,255,0.4)" : d > 0.5 ? C.green : d < -0.5 ? C.coral : C.amb);
const fmtPct = (p) => (p == null ? "—" : `${p > 0 ? "+" : ""}${p.toFixed(1)} %`);
const fmtKg = (k) => (k == null ? "" : `${k > 0 ? "+" : ""}${k.toFixed(1)} kg`);

/* « Efficacité protocole » (staff) — PR-4 de la couche d'analyse. Évolution du 1RM
   estimé, début → fin de chaque programme, agrégée sur l'effectif. Corrélationnel
   (pas de groupe témoin) : on parle d'évolution OBSERVÉE pendant le protocole.
   Verdict d'exercice masqué sous le seuil de k-anonymat ; aucune valeur nominative. */
export default function ProtocolEfficacy({ teamId, sessions = [] }) {
  const { t } = useTranslation();
  const { programs } = usePrograms(teamId);
  const { perf, loading } = useTeamExercisePerf(teamId);
  const [open, setOpen] = useState(null);

  const results = useMemo(
    () => programEfficacy({ programs, sessions, perf }),
    [programs, sessions, perf],
  );
  const withData = results.filter((r) => r.exercises.length > 0);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <TrendingUp size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("staff.efficacy.title")}</div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 12 }}>{t("staff.efficacy.hint")}</div>

      {loading ? (
        <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12 })}>{t("staff.efficacy.loading")}</div>
      ) : withData.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>{t("staff.efficacy.empty", { min: EFFICACY.minPoints })}</div>
      ) : (
        withData.map((r) => {
          const isOpen = open === r.program.id;
          return (
            <div key={r.program.id} style={sc({ marginBottom: 8, padding: 0, overflow: "hidden" })}>
              <div onClick={() => setOpen(isOpen ? null : r.program.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.program.title}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                    {r.program.start ? `${fmtShort(r.program.start)}${r.program.end ? ` → ${fmtShort(r.program.end)}` : ""} · ` : ""}
                    {r.reliableCount > 0 ? t("staff.efficacy.reliableCount", { count: r.reliableCount }) : t("staff.efficacy.noReliable")}
                  </div>
                </div>
                {r.meanPct != null && <div style={{ fontSize: 16, fontWeight: 900, color: deltaColor(r.meanPct) }}>{fmtPct(r.meanPct)}</div>}
                <ChevronDown size={16} color="rgba(255,255,255,0.4)" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
              </div>
              {isOpen && (
                <div style={{ padding: "0 13px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {r.exercises.map((ex) => (
                    <div key={ex.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${C.border2}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                        {ex.reliable ? (
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{t("staff.efficacy.exDetail", { n: ex.nPlayers, improved: ex.nImproved })}</div>
                        ) : (
                          <div style={{ fontSize: 10, color: C.amb, marginTop: 1 }}>{t("staff.efficacy.exInsufficient", { n: ex.nPlayers, min: EFFICACY.minPlayers })}</div>
                        )}
                      </div>
                      {ex.reliable && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: deltaColor(ex.meanPct) }}>{fmtPct(ex.meanPct)}</div>
                          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{fmtKg(ex.meanDelta)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginTop: 4, lineHeight: 1.4 }}>{t("staff.efficacy.caveat")}</div>
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
