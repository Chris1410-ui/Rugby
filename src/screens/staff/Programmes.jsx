import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, CODES, sc, SESSION_CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { fmtShort, todayISO, isoDate, statusOfLog } from "../../lib/metrics.js";
import { WD_ORDER, wdLabel, newExo } from "../../lib/exlib.js";
import { NATURES, natureLabel, natureColor } from "../../lib/nature.js";
import { weekdayDatesInRange, aggregateLoadByDate, overlapForWeekday } from "../../lib/overload.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { Plus, X, Send, FileText, ClipboardList, Paperclip, Video } from "../../lib/icons.jsx";
import { hasVideo } from "../../lib/youtube.js";
import { usePrograms, createProgram, deleteProgram } from "../../data/programs.js";
import { resolveAssignedIds } from "../../data/sessions.js";
import { useRoutines, saveRoutine, deleteRoutine } from "../../data/routines.js";
import { useExercises } from "../../data/exercises.js";
import { parsePDFtoTemplates } from "../../lib/pdf.js";
import { programFolder, uploadFile } from "../../data/storage.js";
import ProgramFiles from "./ProgramFiles.jsx";
import ExercisePickerSheet from "../shared/ExercisePickerSheet.jsx";
import { useReadOnly } from "../../lib/readonly.js";

const accent = C.coral;
const dateSt = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" };
const miniSt = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" };

const ExoRow = ({ exo, onChange, onDel, cues }) => {
  const { t } = useTranslation();
  const vid = (exo.video || "").trim();
  const vidOk = hasVideo(vid);
  return (
    <div style={{ padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input value={exo.name} onChange={(e) => onChange({ name: e.target.value })} list="exlib-list" placeholder={t("staff.programs.exoPlaceholder")} title={cues || ""} style={{ flex: "1 1 150px", minWidth: 120, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 9px", color: "#fff", fontSize: 12, outline: "none" }} />
        <input value={exo.sets} onChange={(e) => onChange({ sets: e.target.value })} placeholder={t("staff.programs.setsPlaceholder")} style={{ width: 48, ...miniSt, textAlign: "center" }} />
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>×</span>
        <input value={exo.reps} onChange={(e) => onChange({ reps: e.target.value })} placeholder={t("staff.programs.repsPlaceholder")} style={{ width: 54, ...miniSt, textAlign: "center" }} />
        <input value={exo.charge} onChange={(e) => onChange({ charge: e.target.value })} placeholder={t("staff.programs.chargePlaceholder")} style={{ width: 80, ...miniSt }} />
        <input value={exo.rest ?? ""} onChange={(e) => onChange({ rest: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" placeholder={t("staff.programs.restPlaceholder")} title={t("staff.programs.restTitle")} style={{ width: 58, ...miniSt, textAlign: "center" }} />
        <button onClick={onDel} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex", padding: 4 }}><X size={14} /></button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <Video size={13} color={vid ? (vidOk ? C.viol : C.amb) : "rgba(255,255,255,0.35)"} />
        <input value={exo.video || ""} onChange={(e) => onChange({ video: e.target.value })} placeholder={t("staff.programs.videoPlaceholder")} style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)", border: `1px solid ${vid && !vidOk ? `${C.amb}88` : C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11, outline: "none" }} />
      </div>
      {vid && !vidOk && <div style={{ fontSize: 10, color: C.amb, marginTop: 3, marginLeft: 19 }}>{t("staff.programs.videoInvalid")}</div>}
    </div>
  );
};

/* Avertissement anti-surcharge sous un jour-modèle : agrège, sur toutes les
   occurrences de ce weekday dans la plage, la charge DÉJÀ prévue du périmètre
   (par nature). Signale surtout l'empilement de MÊME nature (ex. 2× FORCE le
   même jour). Non bloquant — pur repère d'équilibrage. */
function OverloadHint({ weekday, nature, start, end, loadByDate, t }) {
  const dates = useMemo(() => weekdayDatesInRange(start, end, weekday), [weekday, start, end]);
  const { sameNature, sameNatureDays, busyDays, natTotals } = useMemo(
    () => overlapForWeekday(dates, loadByDate, nature),
    [dates, loadByDate, nature],
  );

  if (!dates.length) return null;
  const chips = Object.entries(natTotals).sort((a, b) => b[1] - a[1]);
  const warn = sameNature > 0;
  const info = !warn && busyDays > 0;
  const col = warn ? C.coral : info ? C.amb : C.green;
  const msg = warn
    ? t("staff.programs.overloadSame", { count: sameNature, nature: natureLabel(t, nature), days: sameNatureDays, total: dates.length })
    : info
      ? t("staff.programs.overloadBusy", { days: busyDays, total: dates.length })
      : t("staff.programs.overloadClear");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 10px", padding: "6px 9px", borderRadius: 8, background: `${col}14`, border: `1px solid ${col}44` }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{warn ? "⚠️ " : info ? "" : "✓ "}{msg}</span>
      {chips.length > 0 && (
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {chips.map(([k, v]) => { const c = natureColor(k); return (
            <span key={k} style={{ fontSize: 9.5, fontWeight: 700, color: c, background: `${c}20`, border: `1px solid ${c}44`, borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap" }}>{v}× {natureLabel(t, k)}</span>
          ); })}
        </span>
      )}
    </div>
  );
}

export default function Programmes({ teamId, players, sessions, logs }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { programs } = usePrograms(teamId);
  const { routines } = useRoutines(teamId);
  const { exercises, find } = useExercises(teamId);

  const [view, setView] = useState("list");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(isoDate(new Date(Date.now() + 13 * 864e5)));
  const [recMode, setRecMode] = useState("all");
  const [recGroup, setRecGroup] = useState(players[0]?.grp);
  const [recIds, setRecIds] = useState([]);
  const [templates, setTemplates] = useState([{ weekday: 1, code: "RS", nature: "force", titre: "Séance force", exercises: [newExo()] }]);
  const [pdfFile, setPdfFile] = useState(null); // PDF source à archiver dans Storage
  const [filesOf, setFilesOf] = useState(null); // programme dont on ouvre les fichiers
  const [pickingFor, setPickingFor] = useState(null); // index de séance pour le sélecteur Bibliothèque

  const grps = [...new Set(players.map((p) => p.grp).filter(Boolean))];

  // ── Anti-surcharge : charge DÉJÀ prévue du périmètre de destinataires ──
  // Ensemble des joueurs ciblés (all / ligne / joueurs) selon le mode en cours.
  const recipientIds = useMemo(() => {
    const assigned = recMode === "all" ? { mode: "all" } : recMode === "group" ? { mode: "group", group: recGroup } : { mode: "players", ids: recIds };
    return new Set(resolveAssignedIds(assigned, players));
  }, [recMode, recGroup, recIds, players]);

  // Agrégation des séances existantes de ces joueurs, par date × nature, sur la
  // plage [start, end] (les camps sont comptés : leurs séances sont des sessions
  // datées dans la période). Les protocoles ne sont pas datés → hors agrégation.
  const loadByDate = useMemo(
    () => aggregateLoadByDate(sessions, recipientIds, start, end),
    [sessions, recipientIds, start, end],
  );

  const reset = () => {
    setTitle(""); setStart(todayISO()); setEnd(isoDate(new Date(Date.now() + 13 * 864e5)));
    setRecMode("all"); setRecIds([]); setNote(""); setPdfFile(null);
    setTemplates([{ weekday: 1, code: "RS", nature: "force", titre: "Séance force", exercises: [newExo()] }]);
  };
  const startNew = () => { reset(); setView("new"); };
  const addTpl = () => setTemplates((t) => [...t, { weekday: 3, code: "CSB", nature: "conditioning", titre: "Nouvelle séance", exercises: [newExo()] }]);
  const setTpl = (i, patch) => setTemplates((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setExo = (ti, ei, patch) => setTemplates((t) => t.map((x, j) => (j === ti ? { ...x, exercises: x.exercises.map((e, k) => (k === ei ? { ...e, ...patch } : e)) } : x)));
  const addExo = (ti) => setTemplates((t) => t.map((x, j) => (j === ti ? { ...x, exercises: [...x.exercises, newExo()] } : x)));
  // Ajout depuis la Bibliothèque (1324 exos) : mappe vers la forme newExo (name
  // rempli, séries/reps/charge/repos par défaut, éditables), sans doublon de nom.
  const addFromLibrary = (ti, items) => setTemplates((t) => t.map((x, j) => {
    if (j !== ti) return x;
    const have = new Set(x.exercises.map((e) => (e.name || "").trim().toLowerCase()));
    const fresh = items.filter((e) => !have.has(e.name.trim().toLowerCase())).map((e) => ({ ...newExo(), name: e.name }));
    // Remplace une 1re ligne vide (état initial) plutôt que de laisser un trou.
    const base = x.exercises.length === 1 && !x.exercises[0].name.trim() ? [] : x.exercises;
    return { ...x, exercises: [...base, ...fresh] };
  }));
  const delExo = (ti, ei) => setTemplates((t) => t.map((x, j) => (j === ti ? { ...x, exercises: x.exercises.filter((_, k) => k !== ei) } : x)));
  const delTpl = (ti) => setTemplates((t) => t.filter((_, j) => j !== ti));

  const applyRoutine = (r) => {
    reset();
    setTitle(r.name);
    setTemplates(r.templates.map((t) => ({ ...t, exercises: t.exercises.map((e) => ({ ...e, id: e.id || newExo().id })) })));
    setView("new");
    setNote(t("staff.programs.routineLoaded", { name: r.name }));
  };
  const doSaveRoutine = async () => {
    setNote("");
    if (!title.trim()) return setNote(t("staff.programs.routineErrName"));
    const cleanT = templates.map((tp) => ({ weekday: Number(tp.weekday), code: tp.code, nature: tp.nature || null, titre: tp.titre, exercises: tp.exercises.filter((e) => e.name.trim()) })).filter((tp) => tp.exercises.length);
    if (!cleanT.length) return setNote(t("staff.programs.routineErrExo"));
    try { await saveRoutine(teamId, { name: title, templates: cleanT }); setNote(t("staff.programs.routineSaved")); }
    catch (e) { setNote(t("staff.programs.routineErrSave", { err: e.message })); }
  };

  const onPDF = async (file) => {
    if (!file) return;
    setBusy(true); setNote("");
    setPdfFile(file); // conservé pour archivage dans Storage à l'envoi
    try {
      const tpls = await parsePDFtoTemplates(file);
      setTemplates(tpls.map((t) => ({ ...t, exercises: t.exercises.map((e) => ({ ...e, id: e.id || newExo().id })) })));
      setTitle(file.name.replace(/\.pdf$/i, ""));
      setView("new");
      setNote(t("staff.programs.pdfImported"));
    } catch (e) {
      setView("new");
      setNote(e.message === "no-pdfjs" ? t("staff.programs.pdfNoLib") : t("staff.programs.pdfUnrecognized"));
    }
    setBusy(false);
  };

  const send = async () => {
    if (busy) return;
    setNote("");
    // Validations explicites (fini l'échec silencieux du bouton)
    if (!title.trim()) return setNote(t("staff.programs.errTitle"));
    if (!start || !end || start > end) return setNote(t("staff.programs.errDates"));
    if (recMode === "players" && recIds.length === 0) return setNote(t("staff.programs.errPlayers"));
    if (recMode === "group" && !recGroup) return setNote(t("staff.programs.errGroup"));
    const assigned = recMode === "all" ? { mode: "all" } : recMode === "group" ? { mode: "group", group: recGroup } : { mode: "players", ids: recIds };
    const cleanT = templates
      .map((tp) => ({ weekday: Number(tp.weekday), code: tp.code, nature: tp.nature || null, titre: tp.titre, exercises: tp.exercises.filter((e) => e.name.trim()) }))
      .filter((tp) => tp.exercises.length);
    if (!cleanT.length) return setNote(t("staff.programs.errExo"));

    setBusy(true);
    try {
      const { program, count } = await createProgram(teamId, { title, start, end, assigned, templates: cleanT, source: pdfFile ? "pdf" : "manuel" });
      // Archive le PDF source dans le bucket privé (non bloquant)
      if (pdfFile) {
        try { await uploadFile(programFolder(teamId, program.id), pdfFile); }
        catch (upErr) { console.error("[upload pdf]", upErr.message); }
      }
      setView("list"); reset();
      setNote(t("staff.programs.sent", { count }));
    } catch (e) {
      if (e.code === "no-sessions" || e.message === "no-sessions")
        setNote(t("staff.programs.errNoSessions"));
      else setNote(t("staff.programs.errSend", { err: e.message }));
    }
    setBusy(false);
  };

  // ── LIST ──
  if (view === "list") {
    return (
      <div>
        {!readOnly && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={startNew} style={{ flex: 1, background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Plus size={15} /> {t("staff.programs.newProgram")}
          </button>
          <label style={{ flex: 1, background: `${C.viol}22`, border: `1px solid ${C.viol}55`, borderRadius: 10, padding: 12, color: C.viol, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FileText size={15} />{busy ? t("staff.programs.reading") : t("staff.programs.importPdf")}
            <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => onPDF(e.target.files[0])} />
          </label>
        </div>
        )}

        {note && (
          <div style={sc({ marginBottom: 12, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.85)", background: note.includes("✓") ? `${C.green}1a` : `${C.amb}1a`, borderColor: note.includes("✓") ? `${C.green}66` : `${C.amb}66` })}>{note}</div>
        )}

        {programs.length === 0 && (
          <div style={sc({ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6, marginBottom: 12 })}>
            {t("staff.programs.emptyList")}
          </div>
        )}

        {routines.length > 0 && (
          <Section title={t("staff.programs.routinesTitle")} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{routines.length}</span>}>
            {routines.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${C.viol}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={15} color={C.viol} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{t("staff.programs.routineLine", { sessions: r.templates.length, exos: r.templates.reduce((a, tp) => a + tp.exercises.length, 0) })}</div>
                </div>
                {!readOnly && <button onClick={() => applyRoutine(r)} style={{ background: accent, border: "none", borderRadius: 7, padding: "6px 12px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t("staff.programs.use")}</button>}
                {!readOnly && <button onClick={() => deleteRoutine(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.56)", padding: 4 }}><X size={15} /></button>}
              </div>
            ))}
          </Section>
        )}

        {programs.map((pr) => {
          const mine = sessions.filter((s) => s.programId === pr.id);
          const total = mine.reduce((a, s) => a + s.assignedIds.length, 0);
          const done = mine.reduce((a, s) => a + s.assignedIds.filter((id) => statusOfLog(logs, s.id, id) === "done").length, 0);
          return (
            <div key={pr.id} style={sc({ marginBottom: 10 })}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{pr.title}</span>{pr.source === "pdf" && <Tag c={C.viol}>PDF</Tag>}{/* i18n-ok: format */}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{fmtShort(pr.start)} → {fmtShort(pr.end)} · {t("staff.programs.programSessions", { count: mine.length })}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                    {pr.templates.map((tp, i) => <Tag key={i} c={CODES[tp.code] || accent}>{wdLabel(Number(tp.weekday))} · {tp.titre}</Tag>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setFilesOf(pr)} title={t("staff.programs.filesTitle")} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}><Paperclip size={14} /></button>
                  {!readOnly && <button onClick={() => deleteProgram(pr.id)} title={t("staff.programs.deleteTitle")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.56)", padding: 4 }}><X size={16} /></button>}
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border2}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: 6, width: `${total ? (done / total) * 100 : 0}%`, background: accent, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{t("staff.programs.doneOf", { done, total })}</span>
              </div>
            </div>
          );
        })}
        {filesOf && <ProgramFiles teamId={teamId} program={filesOf} onClose={() => setFilesOf(null)} />}
      </div>
    );
  }

  // ── BUILDER ──
  return (
    <div>
      <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>← {t("staff.programs.back")}</button>
      {note && <div style={sc({ background: `${C.amb}1a`, borderColor: `${C.amb}55`, marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 })}>{note}</div>}

      <Section title={t("staff.programs.sectionProgram")}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("staff.programs.titlePlaceholder")} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 600, outline: "none", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{t("staff.programs.start")}</div><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={dateSt} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{t("staff.programs.end")}</div><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={dateSt} /></div>
        </div>
      </Section>

      <Section title={t("staff.programs.sectionRecipients")}>
        <div style={{ display: "flex", gap: 6, marginBottom: recMode === "all" ? 0 : 10 }}>
          {[["all", t("staff.programs.destAll")], ["group", t("staff.programs.destGroup")], ["players", t("staff.programs.destPlayers")]].map(([v, l]) => (
            <button key={v} onClick={() => setRecMode(v)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: recMode === v ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>{l}</button>
          ))}
        </div>
        {recMode === "group" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {grps.map((g) => <button key={g} onClick={() => setRecGroup(g)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: recGroup === g ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>{grpLabel(g)}</button>)}
          </div>
        )}
        {recMode === "players" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 160, overflowY: "auto" }}>
            {players.map((p) => { const on = recIds.includes(p.id); return (
              <button key={p.id} onClick={() => setRecIds((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${on ? accent : C.border}`, fontSize: 10, fontWeight: 700, cursor: "pointer", background: on ? `${accent}33` : "transparent", color: "#fff" }}>#{p.num} {displayName(p)}</button>
            ); })}
          </div>
        )}
      </Section>

      {templates.map((tpl, ti) => (
        <div key={ti} style={sc({ marginBottom: 10 })}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <select value={tpl.weekday} onChange={(e) => setTpl(ti, { weekday: Number(e.target.value) })} style={miniSt}>{WD_ORDER.map((v) => <option key={v} value={v}>{wdLabel(v)}</option>)}</select>
            <select value={tpl.code} onChange={(e) => setTpl(ti, { code: e.target.value })} style={miniSt}>{SESSION_CODES.map((c) => <option key={c} value={c}>{c} — {sessionCodeLabel(t, c)}</option>)}</select>
            <select value={tpl.nature || "force"} onChange={(e) => setTpl(ti, { nature: e.target.value })} title={t("staff.programs.natureTitle")} style={miniSt}>{NATURES.map((n) => <option key={n} value={n}>{natureLabel(t, n)}</option>)}</select>
            <input value={tpl.titre} onChange={(e) => setTpl(ti, { titre: e.target.value })} placeholder={t("staff.programs.titreSeancePlaceholder")} style={{ flex: 1, minWidth: 120, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 9px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" }} />
            {templates.length > 1 && <button onClick={() => delTpl(ti)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.56)", padding: 4 }}><X size={15} /></button>}
          </div>
          <OverloadHint weekday={tpl.weekday} nature={tpl.nature || "force"} start={start} end={end} loadByDate={loadByDate} t={t} />
          {tpl.exercises.map((exo, ei) => (
            <ExoRow key={exo.id} exo={exo} cues={find(exo.name)?.cues} onChange={(patch) => setExo(ti, ei, patch)} onDel={() => delExo(ti, ei)} />
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => addExo(ti)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={13} /> {t("staff.programs.addExo")}</button>
            <button onClick={() => setPickingFor(ti)} style={{ flex: 1, background: `${C.green}18`, border: `1px solid ${C.green}66`, borderRadius: 8, padding: 7, color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={13} /> {t("staff.programs.addFromLibrary")}</button>
          </div>
        </div>
      ))}
      {pickingFor != null && (
        <ExercisePickerSheet
          onAdd={(items) => addFromLibrary(pickingFor, items)}
          onClose={() => setPickingFor(null)}
          isAdded={(e) => (templates[pickingFor]?.exercises || []).some((x) => (x.name || "").trim().toLowerCase() === e.name.trim().toLowerCase())}
        />
      )}

      <button onClick={addTpl} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 10, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={14} /> {t("staff.programs.addSession")}</button>

      <datalist id="exlib-list">{exercises.map((e) => <option key={e.id} value={e.name} />)}</datalist>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={doSaveRoutine} disabled={!title.trim()} style={{ flex: "0 0 auto", background: `${C.viol}22`, border: `1px solid ${C.viol}66`, borderRadius: 12, padding: "0 16px", color: C.viol, fontWeight: 700, fontSize: 12, cursor: title.trim() ? "pointer" : "default", opacity: title.trim() ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={14} /> {t("staff.programs.routineBtn")}</button>
        <button onClick={send} disabled={!title.trim() || busy} style={{ flex: 1, background: title.trim() ? C.green : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: title.trim() ? "pointer" : "default", opacity: title.trim() && !busy ? 1 : 0.6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Send size={16} /> {busy ? t("staff.programs.sending") : t("staff.programs.sendBtn")}</button>
      </div>
    </div>
  );
}
