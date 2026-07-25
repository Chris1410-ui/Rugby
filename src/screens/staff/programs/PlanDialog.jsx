import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../../lib/tokens.js";
import { CloseX, useModalClose } from "../../../lib/ui.jsx";
import { Calendar, Send } from "../../../lib/icons.jsx";
import { todayISO, fmtShort } from "../../../lib/metrics.js";
import { WD_ORDER, wdLabel } from "../../../lib/exlib.js";
import { deriveSlots, planDocToSessions } from "../../../lib/program/planMaterialize.js";
import { buildAssigned, resolveAssignedIds, useTeamSessions } from "../../../data/sessions.js";
import { aggregateLoadByDate } from "../../../lib/overload.js";
import { createPlan } from "../../../data/programPlans.js";
import RecipientSelect from "../../shared/RecipientSelect.jsx";

const ACCENT = C.green;

/* Dialogue « Planifier ce protocole » : période (début + nb de semaines), weekday
   de chaque créneau, destinataires (sélecteur combiné) + aperçu anti-surcharge.
   Génère le plan + les séances datées liées (progression S1→Sn). */
export default function PlanDialog({ doc, programDocId, teamId, players = [], onClose }) {
  const { t } = useTranslation();
  useModalClose(() => onClose(false));
  const { sessions } = useTeamSessions(teamId, players);

  const defaultWeeks = Math.max(1, Math.min(12, Number(doc?.meta?.weeks) || 4));
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(defaultWeeks);
  const [slots, setSlots] = useState(() => deriveSlots(doc).slots);
  const [rec, setRec] = useState({ all: true, groups: [], ids: [] });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const setSlotDay = (i, wd) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, weekday: Number(wd) } : x)));

  const gen = useMemo(() => planDocToSessions(doc, { startDate, weeks, slots }), [doc, startDate, weeks, slots]);
  const rows = gen.rows;
  const assigned = useMemo(() => buildAssigned(rec), [rec]);

  // Anti-surcharge : jours de la plage où les destinataires ont DÉJÀ une charge.
  const busyDays = useMemo(() => {
    if (!rows.length) return [];
    const ids = new Set(resolveAssignedIds(assigned, players));
    const end = rows[rows.length - 1].date;
    const load = aggregateLoadByDate(sessions, ids, startDate, end);
    const seen = new Set();
    return rows.map((r) => r.date).filter((d) => { if (seen.has(d)) return false; seen.add(d); return load[d]; });
  }, [rows, assigned, players, sessions, startDate]);

  const recipientCount = useMemo(() => resolveAssignedIds(assigned, players).length, [assigned, players]);

  const generate = async () => {
    if (busy) return;
    setNote("");
    if (!startDate) return setNote(t("plan.errDate"));
    if (!rows.length) return setNote(t("plan.errEmpty"));
    setBusy(true);
    try {
      const { count } = await createPlan(teamId, { programDocId, doc, startDate, weeks, slots, assigned });
      onClose(true, t("plan.done", { count }));
    } catch (e) {
      setNote(e.code === "no-sessions" ? t("plan.errEmpty") : t("plan.errSave", { err: e.message || "" }));
      setBusy(false);
    }
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", boxSizing: "border-box" };
  const lbl = { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.4, marginBottom: 5, display: "block" };

  return (
    <div onClick={() => onClose(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Calendar size={18} color={ACCENT} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("plan.title", { name: doc?.meta?.title || doc?.title || "" })}</div>
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

        {note && <div style={{ fontSize: 11.5, color: C.coral, marginBottom: 10 }}>{note}</div>}
        <button onClick={generate} disabled={busy || !rows.length} style={{ width: "100%", background: rows.length ? ACCENT : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: rows.length ? "pointer" : "default", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Send size={15} /> {busy ? t("plan.generating") : t("plan.generate", { count: rows.length })}
        </button>
      </div>
    </div>
  );
}
