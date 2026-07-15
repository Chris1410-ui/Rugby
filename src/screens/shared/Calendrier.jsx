import { C, CODES } from "../../lib/tokens.js";
import { isoDate, parseISO, todayISO, statusOfLog } from "../../lib/metrics.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { ChevronRight } from "../../lib/icons.jsx";

/* Calendrier : pastille sur les jours avec séance (verte = faite, ambre = prévue)
   + agenda. `meId` → vue joueur (ses séances) ; sinon vue staff (toutes). */
export default function Calendrier({ sessions = [], logs = {}, meId, accent = C.coral }) {
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
        title={now.toLocaleDateString("fr-BE", { month: "long", year: "numeric" }).toUpperCase()}
        right={
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", display: "flex", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />fait</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.amb }} />prévu</span>
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

      <Section title={isJoueur ? "MES SÉANCES" : "AGENDA · SÉANCES"}>
        {agenda.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: "6px 0" }}>Aucune séance planifiée.</div>}
        {agenda.map((s) => {
          const d = parseISO(s.date);
          const st = isJoueur ? statusOfLog(logs, s.id, meId) : null;
          const done = s.assignedIds.filter((id) => statusOfLog(logs, s.id, id) === "done").length;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ textAlign: "center", width: 42 }}><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString("fr-BE", { month: "short" })}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{d.getDate()}</div></div>
              <div style={{ width: 3, height: 30, borderRadius: 2, background: CODES[s.code] || accent }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><Tag c={CODES[s.code] || accent}>{s.code}</Tag><span style={{ fontSize: 13, fontWeight: 700 }}>{s.titre}</span></div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{s.exercises.length} exercices</div>
              </div>
              {isJoueur ? (
                st === "done" ? <Tag c={C.green}>Fait</Tag> : st === "missed" ? <Tag c={C.coral}>Manqué</Tag> : s.date <= today ? <Tag c={C.amb}>À valider</Tag> : <Tag c={accent}>À venir</Tag>
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
