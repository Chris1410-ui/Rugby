import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C } from "../../lib/tokens.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { parseISO, todayISO, cmpDate } from "../../lib/metrics.js";
import { effectiveAttendance, attendanceRate } from "../../lib/attendance.js";
import { useTeamTrainings, useTeamAttendance } from "../../data/trainings.js";

const STATE_COLOR = { present: C.green, late: C.amb, absent: C.coral, pending: "rgba(255,255,255,0.45)" };

/* Section « Présences aux entraînements » de la fiche joueur : taux de présence
   sur la saison (basé sur le pointage staff = vérité) + liste des convocations.
   Même lecture staff (fiche) et joueur (self). Données scopées RLS. */
export default function PlayerAttendance({ player, players = [] }) {
  const { t } = useTranslation();
  const { trainings } = useTeamTrainings(player?.team, players);
  const { byTraining } = useTeamAttendance(player?.team);
  const today = todayISO();

  const rows = useMemo(() => {
    return (trainings || [])
      .filter((tr) => (tr.assignedIds || []).includes(player?.id))
      .map((tr) => ({ tr, row: byTraining?.[tr.id]?.[player?.id] || null }))
      .sort((a, b) => cmpDate(b.tr?.date, a.tr?.date));
  }, [trainings, byTraining, player?.id]);

  const rate = useMemo(() => attendanceRate(rows.map((r) => r.row).filter(Boolean)), [rows]);

  if (rows.length === 0) return null; // pas de convocation → section masquée

  return (
    <Section title={t("shared.fiche.attendanceTitle")}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {rate != null
          ? <Tag c={rate >= 80 ? C.green : rate >= 50 ? C.amb : C.coral}>{t("shared.fiche.attendanceRate", { rate })}</Tag>
          : <Tag c={"rgba(255,255,255,0.45)"}>{t("shared.fiche.attendanceNoData")}</Tag>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.slice(0, 10).map(({ tr, row }) => {
          const eff = row?.staffStatus ? row.staffStatus : (tr.date < today ? "pending" : effectiveAttendance(row));
          const d = parseISO(tr.date);
          const pointed = !!row?.staffStatus;
          return (
            <div key={tr.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ textAlign: "center", width: 38, flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString(localeTag(), { month: "short" })}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{d.getDate()}</div>
              </div>
              <div style={{ width: 3, height: 24, borderRadius: 2, background: STATE_COLOR[eff] }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {tr.titre || t("staff.convocations.untitled")}
                {tr.heure ? <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}> · {tr.heure}</span> : null}
              </div>
              <Tag c={STATE_COLOR[eff]}>{t(`staff.convocations.state.${eff}`)}{!pointed && eff !== "pending" ? ` (${t("shared.fiche.attendanceAnnounced")})` : ""}</Tag>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
