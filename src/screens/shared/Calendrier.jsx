import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { isoDate, parseISO, todayISO, statusOfLog } from "../../lib/metrics.js";
import { Section, Tag, NatureTag } from "../../lib/ui.jsx";
import { ChevronRight } from "../../lib/icons.jsx";

/* Calendrier : pastille sur les jours avec séance (verte = faite, ambre = prévue)
   + agenda. `meId` → vue joueur (ses séances) ; sinon vue staff (toutes). */
export default function Calendrier({ sessions = [], logs = {}, meId, accent = C.coral }) {
  const { t } = useTranslation();
  const isJoueur = !!meId;
  const mySessions = isJoueur ? sessions.filter((s) => s.assignedIds.includes(meId)) : sessions;
  const today = todayISO();

  const dayStatus = {};
  mySessions.forEach((s) => {
    const st = isJoueur
      ? statusOfLog(logs, s.id, meId)
      : s.assignedIds.some((id) => statusOfLog(logs, s.id, id) === "done") ? "done" : "pending";
    dayStatus[s.date] = dayStatus[s.date] === "done" ? "done" : st;
  });

  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  const first = new Date(y, mo, 1);
  const startDow = (first.getDay() + 6) % 7;
  const nDays = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(d);

  const agenda = [...mySessions].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <Section
        title={now.toLocaleDateString(localeTag(), { month: "long", year: "numeric" }).toUpperCase()}
        right={
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", display: "flex", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />{t("shared.calendar.legendDone")}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.amb }} />{t("shared.calendar.legendPlanned")}</span>
          </span>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {["L", "M", "M", "J", "V", "S", "D"].map((w, i) => <div key={"h" + i} style={{ textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.56)", fontWeight: 700, paddingBottom: 2 }}>{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={"e" + i} />;
            const iso = isoDate(new Date(y, mo, d));
            const stt = dayStatus[iso];
            const isToday = iso === today;
            return (
              <div key={"d" + i} style={{ aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: isToday ? "rgba(255,255,255,0.1)" : stt ? `${stt === "done" ? C.green : C.amb}1e` : "transparent", border: isToday ? `1px solid ${accent}` : "1px solid transparent" }}>
                <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: stt ? "#fff" : "rgba(255,255,255,0.55)" }}>{d}</span>
                {stt && <span style={{ width: 5, height: 5, borderRadius: 3, background: stt === "done" ? C.green : C.amb }} />}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={isJoueur ? t("shared.calendar.mySessions") : t("shared.calendar.agenda")}>
        {agenda.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: "6px 0" }}>{t("shared.calendar.empty")}</div>}
        {agenda.map((s) => {
          const d = parseISO(s.date);
          const st = isJoueur ? statusOfLog(logs, s.id, meId) : null;
          const done = s.assignedIds.filter((id) => statusOfLog(logs, s.id, id) === "done").length;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ textAlign: "center", width: 42 }}><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString(localeTag(), { month: "short" })}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{d.getDate()}</div></div>
              <div style={{ width: 3, height: 30, borderRadius: 2, background: CODES[s.code] || accent }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><Tag c={CODES[s.code] || accent} title={sessionCodeLabel(t, s.code)}>{s.code}</Tag><NatureTag nature={s.nature} code={s.code} />{s.origin === "libre" && <Tag c={C.viol}>{t("player.session.freeTag")}</Tag>}<span style={{ fontSize: 13, fontWeight: 700 }}>{s.titre}</span></div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{t("shared.calendar.exercisesCount", { count: s.exercises.length })}</div>
              </div>
              {isJoueur ? (
                st === "done" ? <Tag c={C.green}>{t("shared.calendar.tagDone")}</Tag> : st === "missed" ? <Tag c={C.coral}>{t("shared.calendar.tagMissed")}</Tag> : s.date <= today ? <Tag c={C.amb}>{t("shared.calendar.tagToValidate")}</Tag> : <Tag c={accent}>{t("shared.calendar.tagUpcoming")}</Tag>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{done}/{s.assignedIds.length}</span>
              )}
              <ChevronRight size={15} color="rgba(255,255,255,0.3)" />
            </div>
          );
        })}
      </Section>
    </div>
  );
}
