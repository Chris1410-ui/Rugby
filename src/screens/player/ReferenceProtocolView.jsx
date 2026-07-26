import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { REF_WORKOUTS, REF_METHOD, orderWeekdays } from "../../lib/referenceProtocol.js";

/* Vue LECTURE du protocole de référence (staff-athlète) : le split hebdomadaire
   (jambes / haut du corps), les jours, et les exercices avec séries × reps
   (méthode pyramidale 12/10). Rendu depuis les constantes REF_* — source unique,
   identique à ce que createProgram matérialise. Purement informatif. */
export default function ReferenceProtocolView({ accent = C.green }) {
  const { t } = useTranslation();
  const dayNames = t("player.routine.weekdays").split(","); // getDay 0=dim … 6=sam

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{t("player.routine.protoMethod", { method: REF_METHOD })}</div>
      {REF_WORKOUTS.map((w) => (
        <div key={w.key} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{t(`player.routine.proto_${w.key}`)}</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {orderWeekdays(w.days).map((d) => (
                <span key={d} style={{ fontSize: 9.5, fontWeight: 800, color: accent, background: `${accent}1e`, border: `1px solid ${accent}44`, borderRadius: 5, padding: "1px 6px" }}>{dayNames[d]}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {w.exercises.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: i < w.exercises.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600 }}>{e.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{e.sets}×{e.reps}</span>
                {e.rest ? <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>{t("player.routine.protoRest", { s: e.rest })}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
