import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../../lib/tokens.js";
import { CloseX, useModalClose } from "../../../lib/ui.jsx";
import { Calendar, Send } from "../../../lib/icons.jsx";
import { todayISO, fmtShort } from "../../../lib/metrics.js";
import { WD_ORDER, wdLabel } from "../../../lib/exlib.js";
import { displayName } from "../../../lib/identity.js";
import { deriveSlots, planDocToSessions } from "../../../lib/program/planMaterialize.js";
import { buildAssigned, resolveAssignedIds, assignedToSelection, useTeamSessions } from "../../../data/sessions.js";
import { useTeamTrainings } from "../../../data/trainings.js";
import { aggregateLoadByDate } from "../../../lib/overload.js";
import { createPlan, updatePlan } from "../../../data/programPlans.js";
import RecipientSelect from "../../shared/RecipientSelect.jsx";

const ACCENT = C.green;

/* Dialogue « Planifier ce protocole » : période (début + nb de semaines), weekday
   de chaque créneau, destinataires (sélecteur combiné) + aperçu anti-surcharge.
   Génère le plan + les séances datées liées (progression S1→Sn). */
export default function PlanDialog({ doc, programDocId, teamId, players = [], initial = null, onClose }) {
  const { t } = useTranslation();
  useModalClose(() => onClose(false));
  const { sessions } = useTeamSessions(teamId, players);
  const { trainings } = useTeamTrainings(teamId, players);
  const editing = Boolean(initial);

  const defaultWeeks = Math.max(1, Math.min(12, Number(doc?.meta?.weeks) || 4));
  const [startDate, setStartDate] = useState(initial?.startDate || todayISO());
  const [weeks, setWeeks] = useState(initial?.weeks || defaultWeeks);
  const [slots, setSlots] = useState(() => (initial?.slots?.length ? initial.slots : deriveSlots(doc).slots));
  const [rec, setRec] = useState(() => (initial ? assignedToSelection(initial.assigned) : { all: true, groups: [], ids: [] }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // Conflits de non-superposition (protocole↔protocole) à résoudre avant publication.
  const [conflicts, setConflicts] = useState([]); // [{ playerId, docTitle, from, to }]
  const [choices, setChoices] = useState({});      // { [playerId]: 'replace' | 'exclude' }

  const setSlotDay = (i, wd) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, weekday: Number(wd) } : x)));

  const gen = useMemo(() => planDocToSessions(doc, { startDate, weeks, slots }), [doc, startDate, weeks, slots]);
  const rows = gen.rows;
  const assigned = useMemo(() => buildAssigned(rec), [rec]);

  // Anti-surcharge : jours de la plage où les destinataires ont DÉJÀ une charge.
  const busyDays = useMemo(() => {
    if (!rows.length) return [];
    const ids = new Set(resolveAssignedIds(assigned, players));
    const end = rows[rows.length - 1].date;
    const load = aggregateLoadByDate(sessions, ids, startDate, end, trainings);
    const seen = new Set();
    return rows.map((r) => r.date).filter((d) => { if (seen.has(d)) return false; seen.add(d); return load[d]; });
  }, [rows, assigned, players, sessions, trainings, startDate]);

  const recipientCount = useMemo(() => resolveAssignedIds(assigned, players).length, [assigned, players]);

  const generate = async (resolution) => {
    if (busy) return;
    setNote("");
    if (!startDate) return setNote(t("plan.errDate"));
    if (!rows.length) return setNote(t("plan.errEmpty"));
    if (recipientCount === 0) return setNote(t("plan.errNoRecipients"));
    setBusy(true);
    try {
      const common = { startDate, weeks, slots, assigned, roster: players, resolution };
      if (editing) {
        const { inserted, kept } = await updatePlan(initial.id, common, doc, {});
        onClose(true, t("plan.updated", { inserted, kept }));
      } else {
        const { count } = await createPlan(teamId, { programDocId, doc, ...common });
        onClose(true, t("plan.done", { count }));
      }
    } catch (e) {
      if (e.code === "protocol-overlap") {
        // Blocage : on affiche le conflit et on demande un choix par joueur.
        setConflicts(e.conflicts || []);
        setChoices((prev) => {
          const next = { ...prev };
          (e.conflicts || []).forEach((c) => { if (!next[c.playerId]) next[c.playerId] = "replace"; });
          return next;
        });
        setBusy(false);
        return;
      }
      setNote(e.code === "no-sessions" ? t("plan.errEmpty") : e.code === "no-recipients" ? t("plan.errNoRecipients") : t("plan.errSave", { err: e.message || "" }));
      setBusy(false);
    }
  };

  // Conflits groupés par joueur (un joueur peut chevaucher plusieurs protocoles).
  const conflictsByPlayer = useMemo(() => {
    const m = new Map();
    conflicts.forEach((c) => { if (!m.has(c.playerId)) m.set(c.playerId, []); m.get(c.playerId).push(c); });
    return [...m.entries()];
  }, [conflicts]);

  const applyResolution = () => {
    const replace = [], exclude = [];
    conflictsByPlayer.forEach(([pid]) => (choices[pid] === "exclude" ? exclude : replace).push(pid));
    setConflicts([]);
    generate({ replace: [...new Set(replace)], exclude: [...new Set(exclude)] });
  };
  const playerName = (id) => { const p = players.find((x) => x.id === id); return p ? displayName(p) : id; };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", boxSizing: "border-box" };
  const lbl = { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.4, marginBottom: 5, display: "block" };

  return (
    <div onClick={() => onClose(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Calendar size={18} color={ACCENT} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t(editing ? "plan.editTitle" : "plan.title", { name: doc?.meta?.title || doc?.title || "" })}</div>
          <CloseX onClose={() => onClose(false)} />
        </div>

        {/* Période */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}><span style={lbl}>{t("plan.start")}</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inp} /></div>
          <div style={{ flex: "0 0 120px" }}><span style={lbl}>{t("plan.weeks")}</span><input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} style={inp} /></div>
        </div>

        {/* Créneaux → jour de la semaine */}
        <span style={lbl}>{t("plan.slots")}</span>
        {slots.length === 0 ? (
          <div style={{ fontSize: 12, color: C.amb, marginBottom: 12, lineHeight: 1.5 }}>{t("plan.noSlots")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {slots.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                <select value={s.weekday} onChange={(e) => setSlotDay(i, e.target.value)} style={{ ...inp, width: 130, flex: "0 0 auto" }}>
                  {WD_ORDER.map((v) => <option key={v} value={v}>{wdLabel(v)}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Destinataires (sélecteur combiné) */}
        <span style={lbl}>{t("plan.recipients")}</span>
        <div style={{ marginBottom: 12 }}><RecipientSelect players={players} value={rec} onChange={setRec} accent={ACCENT} /></div>

        {/* Aperçu */}
        <div style={sc({ marginBottom: 12, padding: 12 })}>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>{t("plan.preview", { count: rows.length, recipients: recipientCount })}</div>
          {rows.length > 0 && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{fmtShort(rows[0].date)} → {fmtShort(rows[rows.length - 1].date)}</div>}
          {busyDays.length > 0 && <div style={{ fontSize: 11, color: C.amb, marginTop: 6, fontWeight: 700 }}>⚠️ {t("plan.overload", { count: busyDays.length })}</div>}
          {gen.warnings.includes("clamp") && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{t("plan.clampNote")}</div>}
        </div>

        {conflicts.length > 0 ? (
          <div style={sc({ marginBottom: 12, padding: 12, border: `1px solid ${C.coral}66` })}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.coral, marginBottom: 6 }}>{t("plan.overlapTitle")}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 10, lineHeight: 1.5 }}>{t("plan.overlapIntro")}</div>
            {conflictsByPlayer.map(([pid, list]) => (
              <div key={pid} style={{ marginBottom: 10 }}>
                {list.map((c, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: "#fff", marginBottom: 3 }}>
                    {t("plan.overlapLine", { player: playerName(pid), protocol: c.docTitle, from: fmtShort(c.from), to: fmtShort(c.to) })}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {["replace", "exclude"].map((opt) => (
                    <button key={opt} type="button" onClick={() => setChoices((s) => ({ ...s, [pid]: opt }))}
                      style={{ flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${choices[pid] === opt ? ACCENT : C.border}`,
                        background: choices[pid] === opt ? `${ACCENT}22` : "rgba(255,255,255,0.05)",
                        color: choices[pid] === opt ? "#fff" : "rgba(255,255,255,0.6)" }}>
                      {t(opt === "replace" ? "plan.overlapReplace" : "plan.overlapExclude")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setConflicts([])} style={{ flex: "0 0 auto", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "none", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("plan.overlapCancel")}</button>
              <button type="button" onClick={applyResolution} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{t("plan.overlapConfirm")}</button>
            </div>
          </div>
        ) : (
          <>
            {note && <div style={{ fontSize: 11.5, color: C.coral, marginBottom: 10 }}>{note}</div>}
            <button onClick={() => generate()} disabled={busy || !rows.length || recipientCount === 0} style={{ width: "100%", background: rows.length && recipientCount ? ACCENT : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: rows.length && recipientCount ? "pointer" : "default", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Send size={15} /> {busy ? t("plan.generating") : editing ? t("plan.update") : t("plan.generate", { count: rows.length })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
