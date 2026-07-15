import { C } from "../../lib/tokens.js";
import { sc } from "../../lib/tokens.js";
import { todayISO, statusOfLog } from "../../lib/metrics.js";
import SessionPlayCard from "./SessionPlayCard.jsx";

/* Mes séances (joueur) — à faire + historique. */
export default function Seances({ me, sessions, logs, accent }) {
  const mine = sessions.filter((s) => s.assignedIds.includes(me.id));
  const today = todayISO();
  const upcoming = mine.filter((s) => s.date >= today && statusOfLog(logs, s.id, me.id) === "pending");
  const pastOnes = mine.filter((s) => !(s.date >= today && statusOfLog(logs, s.id, me.id) === "pending"));

  if (!mine.length) {
    return (
      <div style={sc({ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.6 })}>
        Aucune séance assignée pour le moment.<br />Ton préparateur t'enverra ton programme ici.
      </div>
    );
  }

  return (
    <div>
      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>À FAIRE · {upcoming.length}</div>
          {upcoming.map((s) => (
            <SessionPlayCard key={s.id} s={s} me={me} log={logs?.[s.id]?.[me.id]} sessions={sessions} logs={logs} accent={accent} />
          ))}
        </>
      )}
      {pastOnes.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700, margin: "16px 0 10px" }}>HISTORIQUE</div>
          {pastOnes.map((s) => (
            <SessionPlayCard key={s.id} s={s} me={me} log={logs?.[s.id]?.[me.id]} sessions={sessions} logs={logs} accent={accent} />
          ))}
        </>
      )}
    </div>
  );
}
