import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { isoDate, parseISO, todayISO, statusOfLog, sessionDisplayState } from "../../lib/metrics.js";
import { Section, Tag, NatureTag } from "../../lib/ui.jsx";
import { ChevronRight } from "../../lib/icons.jsx";

// Couleur et priorité d'affichage par état (le plus « fort » prime sur un jour).
const STATE_COLOR = { done: C.green, missed: C.coral, todo: C.amb, postponed: C.gray };
const STATE_RANK = { done: 3, missed: 2, postponed: 1, todo: 0 };

/* Calendrier : la vraie trace d'activité. Pastille colorée par état (réalisée /
   manquée / à faire / reportée) + agenda avec RPE sur les séances réalisées.
   `meId` → vue joueur (ses séances) ; sinon vue staff (toutes). */
export default function Calendrier({ sessions = [], logs = {}, meId, accent = C.coral }) {
  const { t } = useTranslation();
  const isJoueur = !!meId;
  const mySessions = isJoueur ? sessions.filter((s) => s.assignedIds.includes(meId)) : sessions;
  const today = todayISO();

  // État par jour (le plus fort prime). Joueur : son état ; staff : réalisée si
  // au moins un joueur a validé, sinon « à faire » (prévue).
  const dayStatus = {};
  mySessions.forEach((s) => {
    const st = isJoueur
      ? sessionDisplayState(statusOfLog(logs, s.id, meId), s.date, today)
      : s.assignedIds.some((id) => statusOfLog(logs, s.id, id) === "done") ? "done" : "todo";
    const cur = dayStatus[s.date];
    if (!cur || STATE_RANK[st] > STATE_RANK[cur]) dayStatus[s.date] = st;
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
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />{t("shared.calendar.legendDone")}</span>
            {isJoueur && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.coral }} />{t("shared.calendar.legendMissed")}</span>}
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
            const col = stt ? STATE_COLOR[stt] : null;
            const isToday = iso === today;
            return (
              <div key={"d" + i} style={{ aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: isToday ? "rgba(255,255,255,0.1)" : col ? `${col}1e` : "transparent", border: isToday ? `1px solid ${accent}` : "1px solid transparent" }}>
                <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: col ? "#fff" : "rgba(255,255,255,0.55)" }}>{d}</span>
                {col && <span style={{ width: 5, height: 5, borderRadius: 3, background: col }} />}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={isJoueur ? t("shared.calendar.mySessions") : t("shared.calendar.agenda")}>
        {agenda.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: "6px 0" }}>{t("shared.calendar.empty")}</div>}
        {agenda.map((s) => {
          const d = parseISO(s.date);
          const st = isJoueur ? sessionDisplayState(statusOfLog(logs, s.id, meId), s.date, today) : null;
          const rpe = isJoueur && st === "done" ? logs?.[s.id]?.[meId]?.rpe : null;
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
                st === "done" ? <Tag c={C.green}>{t("shared.calendar.tagDone")}{rpe ? ` · ${t("shared.calendar.rpe", { rpe })}` : ""}</Tag>
                  : st === "missed" ? <Tag c={C.coral}>{t("shared.calendar.tagMissed")}</Tag>
                  : st === "postponed" ? <Tag c={C.gray}>{t("shared.calendar.tagPostponed")}</Tag>
                  : <Tag c={C.amb}>{t("shared.calendar.tagTodo")}</Tag>
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
