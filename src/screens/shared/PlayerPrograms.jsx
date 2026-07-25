import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc, CODES } from "../../lib/tokens.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { FileText, Pencil, Eye, X, AlertOctagon, Dumbbell } from "../../lib/icons.jsx";
import { fmtShort, todayISO } from "../../lib/metrics.js";
import { wdLabel } from "../../lib/exlib.js";
import { usePrograms, updateProgram, markProgramReviewed } from "../../data/programs.js";
import { useProgramDocs, getProgramDoc, markProgramDocReviewed } from "../../data/programDocs.js";
import { useTeamProgramAssignments, assignmentCoversPlayer } from "../../data/programAssignments.js";
import { assignedCoversPlayer } from "../../data/sessions.js";
import ProgramEditor from "../staff/programs/ProgramEditor.jsx";
import ProgramView from "./ProgramView.jsx";

const clone = (o) => JSON.parse(JSON.stringify(o));

/* Vue « Programmes du joueur » (sur la fiche) : agrège les PROTOCOLES (program_docs
   assignés via program_assignments) et les PROGRAMMES HEBDO (programs dont
   `assigned` couvre le joueur). Accès en 2 clics depuis l'effectif (1 clic fiche,
   1 clic programme). Un clic ouvre l'édition directe (staff) ou la consultation
   (joueur). Indicateur « importé — à vérifier » sur les contenus PDF non relus. */
export default function PlayerPrograms({ player, players = [], canEdit }) {
  const { t } = useTranslation();
  const teamId = player?.team;
  const { programs, refresh: refreshPr } = usePrograms(teamId);
  const { docs, refresh: refreshDocs } = useProgramDocs(teamId);
  const { assignments } = useTeamProgramAssignments(teamId);

  const [editProtoId, setEditProtoId] = useState(null);
  const [viewProto, setViewProto] = useState(null); // { id, title, doc }
  const [editProg, setEditProg] = useState(null);    // programme hebdo à éditer

  const items = useMemo(() => {
    const protoIds = new Set(assignments.filter((a) => assignmentCoversPlayer(a, player)).map((a) => a.programId));
    const protos = docs.filter((d) => protoIds.has(d.id)).map((d) => ({
      kind: "protocol", id: d.id, title: d.title, weeks: d.weeks,
      source: d.source, reviewed: d.reviewed, status: d.status, raw: d,
    }));
    const weekday = programs.filter((pr) => assignedCoversPlayer(pr.assigned, player)).map((pr) => ({
      kind: "program", id: pr.id, title: pr.title, start: pr.start, end: pr.end,
      source: pr.source === "pdf" ? "pdf" : "app", reviewed: pr.reviewed, status: null, raw: pr,
    }));
    return [...protos, ...weekday];
  }, [programs, docs, assignments, player]);

  const openProtocol = async (d) => {
    if (canEdit) { setEditProtoId(d.id); return; }
    try { const full = await getProgramDoc(d.id); setViewProto({ id: full.id, title: full.title, doc: full.doc }); }
    catch (e) { console.error("[playerPrograms proto]", e.message); }
  };
  const closeProtoEdit = async () => {
    const id = editProtoId; setEditProtoId(null);
    try { await markProgramDocReviewed(id); } catch { /* best-effort */ }
    refreshDocs();
  };
  const closeProgEdit = (changed) => { setEditProg(null); if (changed) refreshPr(); };

  return (
    <Section title={t("playerPrograms.title", { count: items.length })}>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{t("playerPrograms.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => {
            const toReview = it.source === "pdf" && !it.reviewed;
            const onClick = () => (it.kind === "protocol" ? openProtocol(it.raw) : (canEdit ? setEditProg(it.raw) : null));
            return (
              <div key={`${it.kind}:${it.id}`} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, cursor: canEdit || it.kind === "protocol" ? "pointer" : "default", border: toReview ? `1px solid ${C.amb}66` : `1px solid ${C.border2}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: it.kind === "protocol" ? `${C.viol}22` : `${C.teal}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {it.kind === "protocol" ? <FileText size={15} color={C.viol} /> : <Dumbbell size={15} color={C.teal} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title || t("playerPrograms.untitled")}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 3 }}>
                    {it.kind === "program" && it.start && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)" }}>{fmtShort(it.start)} → {fmtShort(it.end)}</span>}
                    {it.kind === "protocol" && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)" }}>{t("playerPrograms.weeksN", { count: it.weeks })}</span>}
                    <span style={{ fontSize: 9, fontWeight: 800, color: it.source === "pdf" ? C.viol : "rgba(255,255,255,0.5)", border: `1px solid ${it.source === "pdf" ? `${C.viol}66` : C.border}`, borderRadius: 5, padding: "1px 5px" }}>{t(it.source === "pdf" ? "playerPrograms.srcPdf" : "playerPrograms.srcApp")}</span>
                    {it.status === "published" && <Tag c={C.green}>{t("playerPrograms.published")}</Tag>}
                    {it.status === "draft" && <Tag c={C.amb}>{t("playerPrograms.draft")}</Tag>}
                  </div>
                </div>
                {toReview && (
                  <span title={t("playerPrograms.toReview")} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, color: C.amb, background: `${C.amb}1c`, border: `1px solid ${C.amb}66`, borderRadius: 6, padding: "3px 6px", flexShrink: 0 }}>
                    <AlertOctagon size={11} /> {t("playerPrograms.toReviewShort")}
                  </span>
                )}
                {(canEdit || it.kind === "protocol") && (canEdit ? <Pencil size={15} color="rgba(255,255,255,0.6)" /> : <Eye size={15} color="rgba(255,255,255,0.6)" />)}
              </div>
            );
          })}
        </div>
      )}

      {editProtoId && (
        <Overlay>
          <ProgramEditor id={editProtoId} teamId={teamId} players={players} onClose={closeProtoEdit} />
        </Overlay>
      )}
      {viewProto && <ProgramView id={viewProto.id} doc={viewProto.doc} title={viewProto.title} onClose={() => setViewProto(null)} />}
      {editProg && <ProgramQuickEdit program={editProg} teamId={teamId} onClose={closeProgEdit} t={t} />}
    </Section>
  );
}

// Conteneur plein écran pour l'éditeur de protocole (qui se rend en <section> et
// porte déjà son propre bouton retour → onClose).
function Overlay({ children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: C.navy, zIndex: 340, overflowY: "auto", padding: "16px 14px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

/* Édition RAPIDE d'un programme hebdo depuis la fiche : titre + lignes d'exercice
   par jour-modèle, sans rouvrir le constructeur complet. Enregistrement immédiat
   (re-matérialise les séances futures via updateProgram) + marque « relu ». */
function ProgramQuickEdit({ program, teamId, onClose, t }) {
  const [title, setTitle] = useState(program.title || "");
  const [tpls, setTpls] = useState(() => clone(program.templates || []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setExo = (ti, ei, patch) => setTpls((ts) => ts.map((x, j) => (j === ti ? { ...x, exercises: x.exercises.map((e, k) => (k === ei ? { ...e, ...patch } : e)) } : x)));
  const delExo = (ti, ei) => setTpls((ts) => ts.map((x, j) => (j === ti ? { ...x, exercises: x.exercises.filter((_, k) => k !== ei) } : x)));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await updateProgram(teamId, program.id, { title: title.trim() || program.title, start: program.start, end: program.end, assigned: program.assigned, templates: tpls }, { today: todayISO() });
      await markProgramReviewed(program.id).catch(() => {});
      onClose(true);
    } catch (e) { setErr(t("playerPrograms.saveErr", { err: e.message || "" })); setBusy(false); }
  };

  const cell = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", color: "#fff", fontSize: 12, outline: "none" };

  return (
    <div onClick={() => onClose(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", background: C.panel, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("playerPrograms.quickEditTitle")}</div>
          <button onClick={() => onClose(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex" }}><X size={18} /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("playerPrograms.titlePh")} style={{ ...cell, width: "100%", fontSize: 14, fontWeight: 600, marginBottom: 12, boxSizing: "border-box" }} />

        {tpls.map((tp, ti) => (
          <div key={ti} style={sc({ marginBottom: 10, padding: 12 })}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Tag c={CODES[tp.code] || C.teal}>{wdLabel(Number(tp.weekday))}</Tag>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{tp.titre}</span>
            </div>
            {(tp.exercises || []).map((exo, ei) => (
              <div key={exo.id || ei} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <input value={exo.name} onChange={(e) => setExo(ti, ei, { name: e.target.value })} placeholder={t("playerPrograms.exoPh")} style={{ ...cell, flex: "1 1 140px", minWidth: 110 }} />
                <input value={exo.sets ?? ""} onChange={(e) => setExo(ti, ei, { sets: e.target.value })} title={t("playerPrograms.sets")} style={{ ...cell, width: 44, textAlign: "center" }} />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>×</span>
                <input value={exo.reps ?? ""} onChange={(e) => setExo(ti, ei, { reps: e.target.value })} title={t("playerPrograms.reps")} style={{ ...cell, width: 52, textAlign: "center" }} />
                <input value={exo.charge ?? ""} onChange={(e) => setExo(ti, ei, { charge: e.target.value })} placeholder={t("playerPrograms.charge")} style={{ ...cell, width: 72 }} />
                <input value={exo.rest ?? ""} onChange={(e) => setExo(ti, ei, { rest: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" title={t("playerPrograms.rest")} style={{ ...cell, width: 52, textAlign: "center" }} />
                <button onClick={() => delExo(ti, ei)} title={t("playerPrograms.removeExo")} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex", padding: 3 }}><X size={14} /></button>
              </div>
            ))}
            {(tp.exercises || []).length === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{t("playerPrograms.noExo")}</div>}
          </div>
        ))}

        {err && <div style={{ fontSize: 11.5, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: C.green, border: "none", borderRadius: 11, padding: 13, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? t("playerPrograms.saving") : t("playerPrograms.saveNow")}</button>
      </div>
    </div>
  );
}
