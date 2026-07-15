import { useState } from "react";
import { C, CODES, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { fmtShort, todayISO, isoDate, statusOfLog } from "../../lib/metrics.js";
import { WD, wdLabel, newExo } from "../../lib/exlib.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { Plus, X, Send, FileText, ClipboardList, Paperclip, Video } from "../../lib/icons.jsx";
import { hasVideo } from "../../lib/youtube.js";
import { usePrograms, createProgram, deleteProgram } from "../../data/programs.js";
import { useRoutines, saveRoutine, deleteRoutine } from "../../data/routines.js";
import { useExercises } from "../../data/exercises.js";
import { parsePDFtoTemplates } from "../../lib/pdf.js";
import { programFolder, uploadFile } from "../../data/storage.js";
import ProgramFiles from "./ProgramFiles.jsx";

const accent = C.coral;
const dateSt = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" };
const miniSt = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" };

const ExoRow = ({ exo, onChange, onDel, cues }) => {
  const vid = (exo.video || "").trim();
  const vidOk = hasVideo(vid);
  return (
    <div style={{ padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input value={exo.name} onChange={(e) => onChange({ name: e.target.value })} list="exlib-list" placeholder="Exercice" title={cues || ""} style={{ flex: "1 1 150px", minWidth: 120, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 9px", color: "#fff", fontSize: 12, outline: "none" }} />
        <input value={exo.sets} onChange={(e) => onChange({ sets: e.target.value })} placeholder="séries" style={{ width: 48, ...miniSt, textAlign: "center" }} />
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>×</span>
        <input value={exo.reps} onChange={(e) => onChange({ reps: e.target.value })} placeholder="reps" style={{ width: 54, ...miniSt, textAlign: "center" }} />
        <input value={exo.charge} onChange={(e) => onChange({ charge: e.target.value })} placeholder="charge" style={{ width: 80, ...miniSt }} />
        <button onClick={onDel} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex", padding: 4 }}><X size={14} /></button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <Video size={13} color={vid ? (vidOk ? C.viol : C.amb) : "rgba(255,255,255,0.35)"} />
        <input value={exo.video || ""} onChange={(e) => onChange({ video: e.target.value })} placeholder="Lien vidéo YouTube (optionnel)" style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)", border: `1px solid ${vid && !vidOk ? `${C.amb}88` : C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11, outline: "none" }} />
      </div>
      {vid && !vidOk && <div style={{ fontSize: 10, color: C.amb, marginTop: 3, marginLeft: 19 }}>Lien non reconnu — colle une URL YouTube ou un lien http(s).</div>}
    </div>
  );
};

export default function Programmes({ teamId, players, sessions, logs }) {
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
  const [templates, setTemplates] = useState([{ weekday: 1, code: "RS", titre: "Séance force", exercises: [newExo()] }]);
  const [pdfFile, setPdfFile] = useState(null); // PDF source à archiver dans Storage
  const [filesOf, setFilesOf] = useState(null); // programme dont on ouvre les fichiers

  const grps = [...new Set(players.map((p) => p.grp).filter(Boolean))];

  const reset = () => {
    setTitle(""); setStart(todayISO()); setEnd(isoDate(new Date(Date.now() + 13 * 864e5)));
    setRecMode("all"); setRecIds([]); setNote(""); setPdfFile(null);
    setTemplates([{ weekday: 1, code: "RS", titre: "Séance force", exercises: [newExo()] }]);
  };
  const startNew = () => { reset(); setView("new"); };
  const addTpl = () => setTemplates((t) => [...t, { weekday: 3, code: "CSB", titre: "Nouvelle séance", exercises: [newExo()] }]);
  const setTpl = (i, patch) => setTemplates((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setExo = (ti, ei, patch) => setTemplates((t) => t.map((x, j) => (j === ti ? { ...x, exercises: x.exercises.map((e, k) => (k === ei ? { ...e, ...patch } : e)) } : x)));
  const addExo = (ti) => setTemplates((t) => t.map((x, j) => (j === ti ? { ...x, exercises: [...x.exercises, newExo()] } : x)));
  const delExo = (ti, ei) => setTemplates((t) => t.map((x, j) => (j === ti ? { ...x, exercises: x.exercises.filter((_, k) => k !== ei) } : x)));
  const delTpl = (ti) => setTemplates((t) => t.filter((_, j) => j !== ti));

  const applyRoutine = (r) => {
    reset();
    setTitle(r.name);
    setTemplates(r.templates.map((t) => ({ ...t, exercises: t.exercises.map((e) => ({ ...e, id: e.id || newExo().id })) })));
    setView("new");
    setNote(`Modèle « ${r.name} » chargé — ajuste dates et destinataires puis envoie.`);
  };
  const doSaveRoutine = async () => {
    setNote("");
    if (!title.trim()) return setNote("Donne un nom au modèle (champ Titre).");
    const cleanT = templates.map((t) => ({ weekday: Number(t.weekday), code: t.code, titre: t.titre, exercises: t.exercises.filter((e) => e.name.trim()) })).filter((t) => t.exercises.length);
    if (!cleanT.length) return setNote("Ajoute au moins un exercice (avec un nom) avant d'enregistrer le modèle.");
    try { await saveRoutine(teamId, { name: title, templates: cleanT }); setNote("Enregistré comme modèle réutilisable ✓"); }
    catch (e) { setNote("Échec de l'enregistrement du modèle : " + e.message); }
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
      setNote("PDF importé — vérifie et ajuste les exercices avant d'envoyer.");
    } catch (e) {
      setView("new");
      setNote(e.message === "no-pdfjs" ? "Lecture PDF indisponible — saisis la séance manuellement." : "PDF non reconnu automatiquement — complète les exercices ci-dessous.");
    }
    setBusy(false);
  };

  const send = async () => {
    if (busy) return;
    setNote("");
    // Validations explicites (fini l'échec silencieux du bouton)
    if (!title.trim()) return setNote("Donne un titre au programme.");
    if (!start || !end || start > end) return setNote("Vérifie les dates : la fin doit être après le début.");
    if (recMode === "players" && recIds.length === 0) return setNote("Sélectionne au moins un joueur destinataire.");
    if (recMode === "group" && !recGroup) return setNote("Choisis une ligne destinataire.");
    const assigned = recMode === "all" ? { mode: "all" } : recMode === "group" ? { mode: "group", group: recGroup } : { mode: "players", ids: recIds };
    const cleanT = templates
      .map((t) => ({ weekday: Number(t.weekday), code: t.code, titre: t.titre, exercises: t.exercises.filter((e) => e.name.trim()) }))
      .filter((t) => t.exercises.length);
    if (!cleanT.length) return setNote("Ajoute au moins un exercice (avec un nom) à une séance avant d'envoyer.");

    setBusy(true);
    try {
      const { program, count } = await createProgram(teamId, { title, start, end, assigned, templates: cleanT, source: pdfFile ? "pdf" : "manuel" });
      // Archive le PDF source dans le bucket privé (non bloquant)
      if (pdfFile) {
        try { await uploadFile(programFolder(teamId, program.id), pdfFile); }
        catch (upErr) { console.error("[upload pdf]", upErr.message); }
      }
      setView("list"); reset();
      setNote(`Programme envoyé ✓ — ${count} séance${count > 1 ? "s" : ""} créée${count > 1 ? "s" : ""}.`);
    } catch (e) {
      if (e.code === "no-sessions" || e.message === "no-sessions")
        setNote("Aucune séance générée : les dates ne couvrent aucun des jours choisis pour les séances. Élargis la période ou change le jour d'une séance.");
      else setNote("Échec de l'envoi : " + e.message);
    }
    setBusy(false);
  };

  // ── LIST ──
  if (view === "list") {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={startNew} style={{ flex: 1, background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Plus size={15} /> Nouveau programme
          </button>
          <label style={{ flex: 1, background: `${C.viol}22`, border: `1px solid ${C.viol}55`, borderRadius: 10, padding: 12, color: C.viol, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FileText size={15} />{busy ? "Lecture…" : "Importer un PDF"}
            <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => onPDF(e.target.files[0])} />
          </label>
        </div>

        {note && (
          <div style={sc({ marginBottom: 12, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.85)", background: note.startsWith("Programme envoyé") ? `${C.green}1a` : `${C.amb}1a`, borderColor: note.startsWith("Programme envoyé") ? `${C.green}66` : `${C.amb}66` })}>{note}</div>
        )}

        {programs.length === 0 && (
          <div style={sc({ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.6, marginBottom: 12 })}>
            Aucun programme. Crée-en un ou importe un PDF — les séances sont matérialisées et apparaissent chez les joueurs.
          </div>
        )}

        {routines.length > 0 && (
          <Section title="MODÈLES DE ROUTINES" right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{routines.length}</span>}>
            {routines.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${C.viol}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={15} color={C.viol} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{r.templates.length} séance(s) · {r.templates.reduce((a, t) => a + t.exercises.length, 0)} exercices</div>
                </div>
                <button onClick={() => applyRoutine(r)} style={{ background: accent, border: "none", borderRadius: 7, padding: "6px 12px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Utiliser</button>
                <button onClick={() => deleteRoutine(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4 }}><X size={15} /></button>
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
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{pr.title}</span>{pr.source === "pdf" && <Tag c={C.viol}>PDF</Tag>}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{fmtShort(pr.start)} → {fmtShort(pr.end)} · {mine.length} séance(s)</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                    {pr.templates.map((t, i) => <Tag key={i} c={CODES[t.code] || accent}>{wdLabel(Number(t.weekday))} · {t.titre}</Tag>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setFilesOf(pr)} title="Fichiers (PDF / vidéos)" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}><Paperclip size={14} /></button>
                  <button onClick={() => deleteProgram(pr.id)} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 4 }}><X size={16} /></button>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border2}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: 6, width: `${total ? (done / total) * 100 : 0}%`, background: accent, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{done}/{total} réalisé</span>
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
      <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>← Programmes</button>
      {note && <div style={sc({ background: `${C.amb}1a`, borderColor: `${C.amb}55`, marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 })}>{note}</div>}

      <Section title="PROGRAMME">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex. Bloc 0 — Préparation générale)" style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 600, outline: "none", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>Début</div><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={dateSt} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>Fin</div><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={dateSt} /></div>
        </div>
      </Section>

      <Section title="DESTINATAIRES">
        <div style={{ display: "flex", gap: 6, marginBottom: recMode === "all" ? 0 : 10 }}>
          {[["all", "Toute l'équipe"], ["group", "Par ligne"], ["players", "Joueurs"]].map(([v, l]) => (
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
              <button key={p.id} onClick={() => setRecIds((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${on ? accent : C.border}`, fontSize: 10, fontWeight: 700, cursor: "pointer", background: on ? `${accent}33` : "transparent", color: "#fff" }}>#{p.num} {p.name}</button>
            ); })}
          </div>
        )}
      </Section>

      {templates.map((tpl, ti) => (
        <div key={ti} style={sc({ marginBottom: 10 })}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <select value={tpl.weekday} onChange={(e) => setTpl(ti, { weekday: Number(e.target.value) })} style={miniSt}>{WD.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select value={tpl.code} onChange={(e) => setTpl(ti, { code: e.target.value })} style={miniSt}>{Object.keys(CODES).map((c) => <option key={c}>{c}</option>)}</select>
            <input value={tpl.titre} onChange={(e) => setTpl(ti, { titre: e.target.value })} placeholder="Titre séance" style={{ flex: 1, minWidth: 120, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 9px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none" }} />
            {templates.length > 1 && <button onClick={() => delTpl(ti)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 4 }}><X size={15} /></button>}
          </div>
          {tpl.exercises.map((exo, ei) => (
            <ExoRow key={exo.id} exo={exo} cues={find(exo.name)?.cues} onChange={(patch) => setExo(ti, ei, patch)} onDel={() => delExo(ti, ei)} />
          ))}
          <button onClick={() => addExo(ti)} style={{ marginTop: 10, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 8, padding: 7, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={13} /> Ajouter un exercice</button>
        </div>
      ))}

      <button onClick={addTpl} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 10, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={14} /> Ajouter une séance (autre jour)</button>

      <datalist id="exlib-list">{exercises.map((e) => <option key={e.id} value={e.name} />)}</datalist>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={doSaveRoutine} disabled={!title.trim()} style={{ flex: "0 0 auto", background: `${C.viol}22`, border: `1px solid ${C.viol}66`, borderRadius: 12, padding: "0 16px", color: C.viol, fontWeight: 700, fontSize: 12, cursor: title.trim() ? "pointer" : "default", opacity: title.trim() ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={14} /> Modèle</button>
        <button onClick={send} disabled={!title.trim() || busy} style={{ flex: 1, background: title.trim() ? C.green : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: title.trim() ? "pointer" : "default", opacity: title.trim() && !busy ? 1 : 0.6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Send size={16} /> {busy ? "Envoi…" : "Envoyer aux joueurs"}</button>
      </div>
    </div>
  );
}
