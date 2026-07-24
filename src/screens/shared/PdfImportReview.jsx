import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc, SESSION_CODES } from "../../lib/tokens.js";
import { WD_ORDER, wdLabel, newExo } from "../../lib/exlib.js";
import { NATURES, natureLabel } from "../../lib/nature.js";
import { todayISO } from "../../lib/metrics.js";
import { Overlay, CloseX } from "../../lib/ui.jsx";
import { Plus, X } from "../../lib/icons.jsx";

/* Aperçu & VALIDATION obligatoires d'un import PDF (parse faillible). Affiche le
   résultat éditable (séances / exercices), signale les avertissements et les
   lignes non comprises, et n'écrit RIEN sans confirmation explicite. `withPlan`
   (mode joueur) ajoute date de début + nb de semaines ; onConfirm reçoit alors
   (sessions, { startDate, weeks }). En mode staff, onConfirm reçoit (sessions). */
const mini = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" };

export default function PdfImportReview({ result, withPlan = false, onCancel, onConfirm, onArchiveOnly, subtitle, onSkip }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState(() =>
    (result?.sessions || []).map((s) => ({ ...s, exercises: (s.exercises || []).map((e) => ({ ...newExo(), ...e })) })));
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);

  const unread = result?.unread || [];
  const warnings = result?.warnings || [];

  const setS = (i, patch) => setSessions((arr) => arr.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const delS = (i) => setSessions((arr) => arr.filter((_, j) => j !== i));
  const setE = (si, ei, patch) => setSessions((arr) => arr.map((s, j) => (j === si ? { ...s, exercises: s.exercises.map((e, k) => (k === ei ? { ...e, ...patch } : e)) } : s)));
  const delE = (si, ei) => setSessions((arr) => arr.map((s, j) => (j === si ? { ...s, exercises: s.exercises.filter((_, k) => k !== ei) } : s)));
  const addE = (si) => setSessions((arr) => arr.map((s, j) => (j === si ? { ...s, exercises: [...s.exercises, newExo()] } : s)));

  const warnMsg = (w) => t(`pdfImport.warn.${w.code}`, { titre: w.titre, count: w.count, defaultValue: "" });
  const total = sessions.reduce((a, s) => a + s.exercises.filter((e) => (e.name || "").trim()).length, 0);
  const canConfirm = sessions.length > 0 && total > 0 && !busy && (!withPlan || startDate);

  const confirm = async () => {
    // Ne garde que les séances/exos non vides — mais rien n'est écrit ici : on
    // délègue au parent qui persiste après cette validation manuelle.
    const clean = sessions
      .map((s) => ({ weekday: Number(s.weekday) || 0, nature: s.nature || "", code: s.code || "RS", titre: (s.titre || "").trim() || t("pdfImport.defaultSession"), exercises: s.exercises.filter((e) => (e.name || "").trim()) }))
      .filter((s) => s.exercises.length);
    if (!clean.length) return;
    setBusy(true);
    try { await onConfirm(clean, withPlan ? { startDate, weeks: Number(weeks) || 4 } : undefined); }
    finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onCancel} sheet z={360} maxWidth={860}>
      <div style={{ display: "flex", alignItems: "center", padding: "6px 16px 10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{t("pdfImport.title")}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{subtitle || t("pdfImport.intro")}</div>
        </div>
        <CloseX onClose={onCancel} />
      </div>

      <div style={{ padding: "0 16px 20px", maxHeight: "72vh", overflowY: "auto" }}>
        {/* Avertissements */}
        {warnings.length > 0 && (
          <div style={{ background: `${C.amb}14`, border: `1px solid ${C.amb}44`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            {warnings.map((w, i) => { const m = warnMsg(w); return m ? <div key={i} style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>• {m}</div> : null; })}
          </div>
        )}

        {sessions.length === 0 && (
          <div style={sc({ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>{t("pdfImport.noSession")}</div>
        )}

        {/* Séances éditables */}
        {sessions.map((s, si) => (
          <div key={si} style={sc({ marginBottom: 10, padding: 12 })}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <select value={s.weekday} onChange={(e) => setS(si, { weekday: Number(e.target.value) })} style={mini}>{WD_ORDER.map((v) => <option key={v} value={v}>{wdLabel(v)}</option>)}</select>
              <select value={s.code || "RS"} onChange={(e) => setS(si, { code: e.target.value })} style={mini}>{SESSION_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select value={s.nature || ""} onChange={(e) => setS(si, { nature: e.target.value })} style={mini}><option value="">{t("pdfImport.natureNone")}</option>{NATURES.map((n) => <option key={n} value={n}>{natureLabel(t, n)}</option>)}</select>
              <input value={s.titre || ""} onChange={(e) => setS(si, { titre: e.target.value })} placeholder={t("pdfImport.sessionTitle")} style={{ flex: 1, minWidth: 120, ...mini }} />
              <button onClick={() => delS(si)} title={t("pdfImport.removeSession")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4 }}><X size={15} /></button>
            </div>
            {s.exercises.map((e, ei) => (
              <div key={ei} style={{ display: "flex", gap: 6, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${C.border2}` }}>
                <input value={e.name} onChange={(ev) => setE(si, ei, { name: ev.target.value })} placeholder={t("pdfImport.exo")} style={{ flex: "1 1 140px", minWidth: 110, ...mini }} />
                <input value={e.sets} onChange={(ev) => setE(si, ei, { sets: ev.target.value })} style={{ width: 44, textAlign: "center", ...mini }} />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>×</span>
                <input value={e.reps} onChange={(ev) => setE(si, ei, { reps: ev.target.value })} style={{ width: 54, textAlign: "center", ...mini }} />
                <input value={e.charge} onChange={(ev) => setE(si, ei, { charge: ev.target.value })} placeholder={t("pdfImport.charge")} style={{ width: 78, ...mini }} />
                <button onClick={() => delE(si, ei)} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, padding: 4 }}><X size={13} /></button>
              </div>
            ))}
            <button onClick={() => addE(si)} style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 8, padding: 6, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={12} /> {t("pdfImport.addExo")}</button>
          </div>
        ))}

        {/* Lignes non comprises */}
        {unread.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.amb, marginBottom: 6 }}>{t("pdfImport.unreadTitle", { count: unread.length })}</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{t("pdfImport.unreadHint")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 140, overflowY: "auto" }}>
              {unread.map((l, i) => <div key={i} style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontFamily: "monospace", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border2}`, borderRadius: 6, padding: "4px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>)}
            </div>
          </div>
        )}

        {/* Planification (mode joueur) */}
        {withPlan && sessions.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{t("pdfImport.startDate")}</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...mini, width: "100%", colorScheme: "dark" }} />
            </div>
            <div style={{ width: 110 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{t("pdfImport.weeks")}</div>
              <input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(e.target.value)} style={{ ...mini, width: "100%" }} />
            </div>
          </div>
        )}
      </div>

      {/* Barre d'action */}
      <div style={{ display: "flex", gap: 10, padding: "10px 16px 16px", borderTop: `1px solid ${C.border}` }}>
        <button onClick={onCancel} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{onSkip ? t("pdfImport.stop") : t("pdfImport.cancel")}</button>
        {onSkip && (
          <button onClick={onSkip} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 12.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{t("pdfImport.skip")}</button>
        )}
        {onArchiveOnly && (
          <button onClick={() => { setBusy(true); Promise.resolve(onArchiveOnly()).finally(() => setBusy(false)); }} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 12.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{t("pdfImport.archiveOnly")}</button>
        )}
        <button onClick={confirm} disabled={!canConfirm} style={{ flex: 2, background: canConfirm ? C.green : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: canConfirm ? "pointer" : "default", opacity: canConfirm ? 1 : 0.6 }}>
          {t("pdfImport.confirm", { count: sessions.length })}
        </button>
      </div>
    </Overlay>
  );
}
