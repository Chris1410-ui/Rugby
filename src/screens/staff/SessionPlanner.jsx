import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, SESSION_CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { NATURES, natureLabel } from "../../lib/nature.js";
import { newExo } from "../../lib/exlib.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { Plus, X } from "../../lib/icons.jsx";
import { createSession, updateSession, createSessionsRecurring, updateSessionSeries, deleteSessionSeries, buildAssigned, assignedToSelection, resolveAssignedIds } from "../../data/sessions.js";
import { getRecurrenceSeries, seriesToValue } from "../../data/recurrence.js";
import { getClubId } from "../../data/catalog.js";
import RecipientSelect from "../shared/RecipientSelect.jsx";
import RecurrenceSelector from "../shared/RecurrenceSelector.jsx";
import ExerciseAutocomplete from "../shared/ExerciseAutocomplete.jsx";

const accent = C.coral;
const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" };
const mini = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" };
const lbl = { fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginBottom: 4 };
const scopeBtn = (on) => ({ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.04)", color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, cursor: "pointer" });

/* « Planifier une séance » (staff/owner) : crée une séance datée UNIQUE ou une
   SÉRIE récurrente (moteur partagé recurrence_series). `initial` (séance existante)
   → mode ÉDITION, avec bascule occurrence ↔ série quand la séance appartient à une
   série. Le passé, le personnalisé et le déjà réalisé ne sont jamais régénérés. */
export default function SessionPlanner({ teamId, players = [], initial = null, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const editing = Boolean(initial);
  const [d, setD] = useState(() => ({
    titre: initial?.titre || "", code: initial?.code || "RS", nature: initial?.nature || "force", durationMin: initial?.dur || 60,
  }));
  const [exos, setExos] = useState(() => (initial?.exercises?.length ? initial.exercises.map((e) => ({ ...newExo(), ...e })) : [newExo()]));
  const [rec, setRec] = useState(() => assignedToSelection(initial?.assigned));
  const [recur, setRecur] = useState(() => ({ mode: "once", date: initial?.date || todayISO(), time: "", weekdays: [], times: {}, start: initial?.date || todayISO(), end: "", exclusions: [] }));
  const [scope, setScope] = useState("occurrence");
  const [clubId, setClubId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setErr(""); };
  useEffect(() => { let a = true; getClubId(teamId).then((id) => { if (a) setClubId(id); }); return () => { a = false; }; }, [teamId]);

  const setExo = (i, patch) => setExos((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addExo = () => setExos((xs) => [...xs, newExo()]);
  const delExo = (i) => setExos((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs));

  const cleanExos = () => exos.filter((e) => (e.name || "").trim());
  const recipientCount = resolveAssignedIds(buildAssigned(rec), players).length;
  const payload = () => ({ titre: d.titre.trim() || t("staff.sessionPlanner.defaultTitle"), code: d.code || "RS", nature: d.nature || null, durationMin: Number(d.durationMin) || 60, exercises: cleanExos() });

  const toSeriesScope = async () => {
    try {
      const s = await getRecurrenceSeries(initial.seriesId);
      setRecur(seriesToValue(s));
      const p = s.payload || {};
      setD({ titre: p.titre || "", code: p.code || "RS", nature: p.nature || "force", durationMin: p.durationMin || 60 });
      setExos(p.exercises?.length ? p.exercises.map((e) => ({ ...newExo(), ...e })) : [newExo()]);
      setRec(assignedToSelection(s.assigned)); setScope("series"); setErr("");
    } catch (e) { setErr(t("staff.sessionPlanner.errSave", { err: e.message || "" })); }
  };
  const toOccurrenceScope = () => {
    setRecur({ mode: "once", date: initial.date || todayISO(), time: "", weekdays: [], times: {}, start: initial.date || todayISO(), end: "", exclusions: [] });
    setScope("occurrence"); setErr("");
  };
  const delSeries = async () => {
    if (!confirm(t("recurrence.delSeriesConfirm"))) return;
    setBusy(true); setErr("");
    try { await deleteSessionSeries(initial.seriesId, { today: todayISO() }); onClose(); }
    catch (e) { setErr(t("staff.sessionPlanner.errSave", { err: e.message || "" })); setBusy(false); }
  };

  const save = async () => {
    if (!d.titre.trim()) return setErr(t("staff.sessionPlanner.errTitle"));
    const assigned = buildAssigned(rec);
    setBusy(true); setErr("");
    try {
      if (editing && scope === "series") {
        await updateSessionSeries(initial.seriesId, teamId, { value: recur, assigned, payload: payload() }, { today: todayISO() });
      } else if (!editing && recur.mode === "recurring") {
        const r = await createSessionsRecurring(teamId, clubId, { value: recur, assigned, payload: payload() });
        if (!r.count) throw new Error("no_occurrences");
      } else if (editing) {
        await updateSession(initial.id, { ...payload(), date: recur.date || initial.date }, { customized: !!initial.seriesId });
      } else {
        await createSession(teamId, { ...payload(), date: recur.date || todayISO() });
      }
      onClose();
    } catch (e) {
      setErr(e.message === "no_occurrences" ? t("recurrence.errNoOcc") : t("staff.sessionPlanner.errSave", { err: e.message || "" }));
      setBusy(false);
    }
  };

  const saveLabel = busy ? "…"
    : scope === "series" ? t("recurrence.updateSeries")
    : !editing && recur.mode === "recurring" ? t("recurrence.saveRecurring")
    : editing ? t("staff.sessionPlanner.saveEdit") : t("staff.sessionPlanner.create");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 330, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, background: C.navy, borderRadius: 18, padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{editing ? t("staff.sessionPlanner.editTitle") : t("staff.sessionPlanner.newTitle")}</div>
          <CloseX onClose={onClose} />
        </div>

        <input value={d.titre} onChange={(e) => set("titre", e.target.value)} placeholder={t("staff.sessionPlanner.titlePlaceholder")} maxLength={90} style={inp} />
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 120px" }}><div style={lbl}>{t("staff.sessionPlanner.code")}</div><select value={d.code} onChange={(e) => set("code", e.target.value)} style={{ ...mini, width: "100%" }}>{SESSION_CODES.map((c) => <option key={c} value={c}>{c} — {sessionCodeLabel(t, c)}</option>)}</select></div>
          <div style={{ flex: "1 1 120px" }}><div style={lbl}>{t("staff.sessionPlanner.nature")}</div><select value={d.nature} onChange={(e) => set("nature", e.target.value)} style={{ ...mini, width: "100%" }}>{NATURES.map((n) => <option key={n} value={n}>{natureLabel(t, n)}</option>)}</select></div>
          <div style={{ flex: "0 0 90px" }}><div style={lbl}>{t("staff.sessionPlanner.duration")}</div><input type="number" min={0} max={600} value={d.durationMin} onChange={(e) => set("durationMin", e.target.value)} style={{ ...mini, width: "100%", textAlign: "center" }} /></div>
        </div>

        {editing && initial.seriesId && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={toOccurrenceScope} style={scopeBtn(scope === "occurrence")}>{t("recurrence.scopeOne")}</button>
            <button type="button" onClick={toSeriesScope} style={scopeBtn(scope === "series")}>{t("recurrence.scopeSeries")}</button>
          </div>
        )}
        {scope === "series" && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginBottom: 8, lineHeight: 1.5 }}>{t("recurrence.seriesHint")}</div>}
        <div style={{ marginBottom: 10 }}>
          <RecurrenceSelector value={recur} onChange={(nv) => { setRecur(nv); setErr(""); }} recipientCount={recipientCount} allowRecurring={!editing || scope === "series"} accent={accent} />
        </div>

        <div style={lbl}>{t("staff.sessionPlanner.exercises")}</div>
        <div style={{ marginBottom: 10 }}>
          {exos.map((exo, i) => (
            <div key={exo.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ flex: "1 1 150px", minWidth: 110 }}>
                <ExerciseAutocomplete value={exo.name} onChange={(v) => setExo(i, { name: v })} placeholder={t("staff.sessionPlanner.exoPlaceholder")} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 9px", color: "#fff", fontSize: 12, outline: "none" }} />
              </div>
              <input value={exo.sets} onChange={(e) => setExo(i, { sets: e.target.value })} placeholder={t("staff.sessionPlanner.setsPlaceholder")} style={{ ...mini, width: 44, textAlign: "center" }} />
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>×</span>
              <input value={exo.reps} onChange={(e) => setExo(i, { reps: e.target.value })} placeholder={t("staff.sessionPlanner.repsPlaceholder")} style={{ ...mini, width: 50, textAlign: "center" }} />
              <input value={exo.charge} onChange={(e) => setExo(i, { charge: e.target.value })} placeholder={t("staff.sessionPlanner.chargePlaceholder")} style={{ ...mini, width: 74 }} />
              <button onClick={() => delExo(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex", padding: 4 }}><X size={14} /></button>
            </div>
          ))}
          <button onClick={addExo} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={13} /> {t("staff.sessionPlanner.addExo")}</button>
        </div>

        <div style={lbl}>{t("staff.sessionPlanner.recipients")}</div>
        <div style={{ marginBottom: 10 }}><RecipientSelect players={players} value={rec} onChange={setRec} accent={accent} /></div>

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{saveLabel}</button>
        {scope === "series" && <button onClick={delSeries} disabled={busy} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: C.coral, fontSize: 11.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{t("recurrence.deleteSeries")}</button>}
      </div>
    </div>
  );
}
