import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { todayISO, statusOfLog, fmtShort } from "../../lib/metrics.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { Flag, CheckCircle } from "../../lib/icons.jsx";
import { usePreview } from "../../lib/preview.js";
import { enrollInSession } from "../../data/sessions.js";
import { useTeamCamps, useMyCampEnrollments, enrollInCamp } from "../../data/camps.js";
import SessionPlayCard from "./SessionPlayCard.jsx";

/* Mes séances (joueur) — inscriptions ouvertes + à faire + historique. */
export default function Seances({ me, sessions, logs, teamId, accent }) {
  const { t } = useTranslation();
  const mine = sessions.filter((s) => s.assignedIds.includes(me.id));
  const today = todayISO();
  const upcoming = mine.filter((s) => s.date >= today && statusOfLog(logs, s.id, me.id) === "pending");
  const pastOnes = mine.filter((s) => !(s.date >= today && statusOfLog(logs, s.id, me.id) === "pending"));

  return (
    <div>
      <OpenEnrollments me={me} sessions={sessions} teamId={teamId} accent={accent} />

      {mine.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.6 })}>
          {t("player.seances.emptyTitle")}<br />{t("player.seances.emptyHint")}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>{t("player.seances.todo")} · {upcoming.length}</div>
              {upcoming.map((s) => (
                <SessionPlayCard key={s.id} s={s} me={me} log={logs?.[s.id]?.[me.id]} sessions={sessions} logs={logs} accent={accent} />
              ))}
            </>
          )}
          {pastOnes.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700, margin: "16px 0 10px" }}>{t("player.seances.history")}</div>
              {pastOnes.map((s) => (
                <SessionPlayCard key={s.id} s={s} me={me} log={logs?.[s.id]?.[me.id]} sessions={sessions} logs={logs} accent={accent} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* Camps & séances « inscription libre » où le joueur n'est pas encore inscrit.
   « Je m'inscris » l'ajoute aux destinataires (RPC enroll_in_session) ou au camp
   (camp_participants). Désactivé en mode aperçu (lecture seule). */
function OpenEnrollments({ me, sessions, teamId, accent }) {
  const { t } = useTranslation();
  const preview = usePreview();
  const today = todayISO();
  const { camps } = useTeamCamps(teamId);
  const { enrolledIds } = useMyCampEnrollments(me.id);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");

  const openSessions = sessions.filter((s) => s.assigned?.mode === "open" && s.date >= today && !s.assignedIds.includes(me.id));
  const openCamps = camps.filter((c) => c.dateFin >= today && !enrolledIds.has(c.id));

  if (openSessions.length === 0 && openCamps.length === 0) return null;

  const run = async (k, fn) => {
    if (preview) return;
    setBusy(k); setNote("");
    try { await fn(); setNote(t("player.seances.enrolled")); }
    catch (e) { setNote(t("common.actionFailed", { err: e.message || t("common.tryAgain") })); }
    setBusy(null);
  };

  const btn = (k, onClick) => (
    <button onClick={onClick} disabled={preview || busy === k} style={{ background: preview ? "rgba(255,255,255,0.06)" : accent, border: "none", borderRadius: 8, padding: "7px 12px", color: preview ? "rgba(255,255,255,0.5)" : "#fff", fontSize: 11, fontWeight: 800, cursor: preview ? "default" : "pointer", opacity: busy === k ? 0.6 : 1, whiteSpace: "nowrap" }}>
      {preview ? t("player.seances.preview") : busy === k ? "…" : t("player.seances.enroll")}
    </button>
  );

  return (
    <Section title={t("player.seances.openTitle")} right={<Flag size={14} color={C.viol} />}>
      {note && <div style={{ fontSize: 11, marginBottom: 8, color: note.startsWith("Échec") ? C.coral : C.green }}>{note}</div>}
      {openCamps.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
          <Flag size={16} color={C.viol} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{c.nom}</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)" }}>{t("player.seances.campLine", { from: fmtShort(c.dateDebut), to: fmtShort(c.dateFin) })}</div>
          </div>
          {btn(`camp:${c.id}`, () => run(`camp:${c.id}`, () => enrollInCamp(c.id, me.id, me.team)))}
        </div>
      ))}
      {openSessions.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
          <CheckCircle size={16} color={C.teal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{s.titre} <Tag c={C.teal}>{s.code}</Tag></div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)" }}>{t("player.seances.sessionLine", { date: fmtShort(s.date), count: s.assignedIds.length })}</div>
          </div>
          {btn(`sess:${s.id}`, () => run(`sess:${s.id}`, () => enrollInSession(s.id)))}
        </div>
      ))}
    </Section>
  );
}
