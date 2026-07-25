import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { usePreview } from "../../lib/preview.js";
import { useTeamTrainings, useTeamAttendance } from "../../data/trainings.js";
import ConvocationRespondCard from "../shared/ConvocationRespondCard.jsx";

/* « Convocations » (joueur) : les entraînements auxquels je suis convoqué, à
   venir puis passés. Je réponds présent / absent / en retard. Lecture seule en
   aperçu owner/staff. */
export default function Convocations({ me, players = [], accent = C.coral }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const { trainings } = useTeamTrainings(me.team, players);
  const { byTraining } = useTeamAttendance(me.team); // RLS → mes lignes uniquement
  const today = todayISO();

  const { upcoming, past } = useMemo(() => {
    const sorted = [...trainings].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcoming: sorted.filter((tr) => tr.date >= today),
      past: sorted.filter((tr) => tr.date < today).reverse(),
    };
  }, [trainings, today]);

  const mineOf = (tr) => byTraining?.[tr.id]?.[me.id] || null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📣</span>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t("player.convocations.title")}</div>
      </div>

      {trainings.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>{t("player.convocations.empty")}</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: past.length ? 18 : 0 }}>
              {upcoming.map((tr) => <ConvocationRespondCard key={tr.id} tr={tr} mine={mineOf(tr)} accent={accent} readOnly={preview} />)}
            </div>
          )}
          {past.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: 0.4, margin: "4px 2px 8px" }}>{t("player.convocations.pastTitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {past.map((tr) => <ConvocationRespondCard key={tr.id} tr={tr} mine={mineOf(tr)} accent={accent} readOnly />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
