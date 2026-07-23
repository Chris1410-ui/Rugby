import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { ChevronLeft, ChevronDown, Plus, Trash2, FileText, Dumbbell, Search, Check } from "../../../lib/icons.jsx";
import { getProgramDoc, updateProgramDoc } from "../../../data/programDocs.js";
import {
  emptyNarrativeSection, emptyExerciseSection, emptyRow, emptyProgram,
  changeWeeks, clampWeeks, blockTint, MIN_WEEKS, MAX_WEEKS,
} from "../../../lib/program/model.js";
import ExercisePickerSheet from "../../shared/ExercisePickerSheet.jsx";
import ProgramView from "../../shared/ProgramView.jsx";
import { Eye } from "../../../lib/icons.jsx";

const ACCENT = C.coral;
// Couleurs des accents de colonne/chiffre (code → teinte du thème « stade »).
const ACC = { c: "#38D2E6", a: "#E8A33D", m: "#94A2B2", r: "#E5484D", v: "#4FBF7B" };
const WEEK_ACCENTS = ["c", "a", "m"];
const FACT_ACCENTS = ["c", "a"];
const clone = (o) => JSON.parse(JSON.stringify(o));
const cycle = (list, v) => list[(list.indexOf(v) + 1) % list.length];

const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };
const lbl = { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 5, display: "block" };

/* Éditeur d'un PROTOCOLE : métadonnées (hero), puis sections narratives
   (Markdown-léger) et sections d'exercices (grille blocs × semaines, cellules
   éditables, ajout libre OU depuis la bibliothèque). Sauvegarde explicite +
   à la fermeture si des changements sont en attente. */
export default function ProgramEditor({ id, onClose }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("draft");
  const [weeks, setWeeksState] = useState(4);
  const [doc, setDocState] = useState(emptyProgram(4));
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null); // index de la section d'exercices ciblée
  const [preview, setPreview] = useState(false); // aperçu « stade » du document en cours

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getProgramDoc(id);
        if (!alive) return;
        setTitle(d.title); setCategory(d.category); setStatus(d.status);
        setWeeksState(d.weeks); setDocState(d.doc);
      } catch (e) { console.error("[editor load]", e.message); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  const setDoc = (updater) => { setDocState((d) => updater(clone(d))); setDirty(true); };
  const mark = (setter) => (v) => { setter(v); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      await updateProgramDoc(id, { title, category, status, weeks, doc: { ...doc, meta: { ...doc.meta, weeks } } });
      setDirty(false);
    } catch (e) { console.error("[editor save]", e.message); }
    setSaving(false);
  };
  const back = async () => { if (dirty) await save(); onClose(); };

  // Métadonnées / hero -------------------------------------------------------
  const setMeta = (patch) => setDoc((d) => { d.meta = { ...d.meta, ...patch }; return d; });
  const setBadge = (patch) => setDoc((d) => { d.meta.badge = { ...d.meta.badge, ...patch }; return d; });
  const applyWeeks = (n) => {
    const w = clampWeeks(n);
    setDocState((d) => changeWeeks({ ...clone(d), meta: { ...d.meta, weeks: w } }, w));
    setWeeksState(w); setDirty(true);
  };

  // Chiffres-clés (facts) ----------------------------------------------------
  const addFact = () => setDoc((d) => { d.meta.facts = [...(d.meta.facts || []), { n: "", label: "", accent: "c" }]; return d; });
  const setFact = (i, patch) => setDoc((d) => { d.meta.facts[i] = { ...d.meta.facts[i], ...patch }; return d; });
  const delFact = (i) => setDoc((d) => { d.meta.facts.splice(i, 1); return d; });

  // Sections -----------------------------------------------------------------
  const addSection = (type) => setDoc((d) => { d.sections.push(type === "narrative" ? emptyNarrativeSection() : emptyExerciseSection(weeks)); return d; });
  const setSection = (i, patch) => setDoc((d) => { d.sections[i] = { ...d.sections[i], ...patch }; return d; });
  const moveSection = (i, dir) => setDoc((d) => { const j = i + dir; if (j < 0 || j >= d.sections.length) return d; [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]]; return d; });
  const delSection = (i) => setDoc((d) => { d.sections.splice(i, 1); return d; });

  // Lignes d'exercice --------------------------------------------------------
  const addRow = (si, row) => setDoc((d) => { d.sections[si].rows.push(row || emptyRow(weeks)); return d; });
  const setRow = (si, ri, patch) => setDoc((d) => { d.sections[si].rows[ri] = { ...d.sections[si].rows[ri], ...patch }; return d; });
  const moveRow = (si, ri, dir) => setDoc((d) => { const j = ri + dir, rows = d.sections[si].rows; if (j < 0 || j >= rows.length) return d; [rows[ri], rows[j]] = [rows[j], rows[ri]]; return d; });
  const delRow = (si, ri) => setDoc((d) => { d.sections[si].rows.splice(ri, 1); return d; });
  const setCell = (si, ri, wi, patch) => setDoc((d) => { d.sections[si].rows[ri].weeks[wi] = { ...d.sections[si].rows[ri].weeks[wi], ...patch }; return d; });
  const setWeekAccent = (si, wi) => setDoc((d) => { const s = d.sections[si]; s.weekAccents[wi] = cycle(WEEK_ACCENTS, s.weekAccents[wi] || "c"); return d; });
  const setWeekLabel = (si, wi, v) => setDoc((d) => { d.sections[si].weekLabels[wi] = v; return d; });

  const addFromLibrary = (exs) => {
    if (picker == null) return;
    setDoc((d) => {
      exs.forEach((ex) => d.sections[picker].rows.push({ ...emptyRow(weeks), name: ex.name, exerciseRef: ex.ref, exerciseId: ex.id }));
      return d;
    });
  };

  if (loading) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", padding: 8 }}>{t("protocols.loading")}</div>;

  const pickerSection = picker != null ? doc.sections[picker] : null;
  const pickedRefs = new Set((pickerSection?.rows || []).map((r) => r.exerciseRef).filter(Boolean));

  return (
    <section>
      {/* Barre d'action */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={back} title={t("protocols.back")} style={{ ...iconBtn, color: "#fff" }}><ChevronLeft size={17} /></button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || t("protocols.untitled")}</div>
        {dirty && <span style={{ fontSize: 10.5, color: C.amb, fontWeight: 700 }}>{t("protocols.unsaved")}</span>}
        <button onClick={() => setPreview(true)} title={t("protocols.preview")} style={{ ...iconBtn, color: "#fff" }}><Eye size={16} /></button>
        <button onClick={save} disabled={saving || !dirty} style={{ background: dirty ? ACCENT : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "9px 15px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: dirty ? "pointer" : "default" }}>
          {saving ? t("protocols.saving") : t("protocols.save")}
        </button>
      </div>

      {/* ── Métadonnées ── */}
      <Block title={t("protocols.metadata")}>
        <div style={grid2}>
          <Field label={t("protocols.fTitle")}><input style={inp} value={title} onChange={(e) => mark(setTitle)(e.target.value)} placeholder={t("protocols.fTitlePh")} /></Field>
          <Field label={t("protocols.fCategory")}><input style={inp} value={category} onChange={(e) => mark(setCategory)(e.target.value)} placeholder={t("protocols.fCategoryPh")} /></Field>
          <Field label={t("protocols.fWeeks")}>
            <input style={inp} type="number" min={MIN_WEEKS} max={MAX_WEEKS} value={weeks} onChange={(e) => applyWeeks(e.target.value)} />
          </Field>
          <Field label={t("protocols.fSessions")}>
            <input style={inp} type="number" min={0} value={doc.meta.sessionsPerWeek ?? ""} onChange={(e) => setMeta({ sessionsPerWeek: e.target.value === "" ? null : Number(e.target.value) })} placeholder="4" />
          </Field>
          <Field label={t("protocols.fStart")}><input style={inp} type="date" value={doc.meta.startDate || ""} onChange={(e) => setMeta({ startDate: e.target.value || null })} /></Field>
          <Field label={t("protocols.fEnd")}><input style={inp} type="date" value={doc.meta.endDate || ""} onChange={(e) => setMeta({ endDate: e.target.value || null })} /></Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={lbl}>{t("protocols.fStatus")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {["draft", "published"].map((s) => (
              <button key={s} onClick={() => mark(setStatus)(s)} style={{ flex: 1, background: status === s ? `${ACCENT}22` : "rgba(255,255,255,0.05)", border: `1px solid ${status === s ? ACCENT : C.border}`, borderRadius: 9, padding: "8px 10px", color: status === s ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {s === "published" ? t("protocols.statusPublished") : t("protocols.statusDraft")}
              </button>
            ))}
          </div>
        </div>
      </Block>

      {/* ── Hero ── */}
      <Block title={t("protocols.hero")}>
        <div style={grid2}>
          <Field label={t("protocols.hBadgeBig")}><input style={inp} value={doc.meta.badge?.big || ""} onChange={(e) => setBadge({ big: e.target.value })} placeholder="C1" /></Field>
          <Field label={t("protocols.hBadgeTag")}><input style={inp} value={doc.meta.badge?.tag || ""} onChange={(e) => setBadge({ tag: e.target.value })} placeholder={t("protocols.hBadgeTagPh")} /></Field>
        </div>
        <Field label={t("protocols.hEyebrow")}><input style={inp} value={doc.meta.eyebrow || ""} onChange={(e) => setMeta({ eyebrow: e.target.value })} placeholder={t("protocols.hEyebrowPh")} /></Field>
        <Field label={t("protocols.hTitle")}><input style={inp} value={doc.meta.title || ""} onChange={(e) => setMeta({ title: e.target.value })} placeholder={t("protocols.hTitlePh")} /></Field>
        <Field label={t("protocols.hLede")}><textarea style={{ ...inp, minHeight: 62, resize: "vertical", fontFamily: "inherit" }} value={doc.meta.lede || ""} onChange={(e) => setMeta({ lede: e.target.value })} placeholder={t("protocols.hLedePh")} /></Field>
        <Field label={t("protocols.hSources")}><input style={inp} value={doc.meta.sources || ""} onChange={(e) => setMeta({ sources: e.target.value })} placeholder={t("protocols.hSourcesPh")} /></Field>
        <Field label={t("protocols.hMantra")}><input style={inp} value={doc.meta.mantra || ""} onChange={(e) => setMeta({ mantra: e.target.value })} placeholder={t("protocols.hMantraPh")} /></Field>

        {/* Chiffres-clés */}
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <span style={{ ...lbl, marginBottom: 0, flex: 1 }}>{t("protocols.hFacts")}</span>
            <button onClick={addFact} style={miniBtn}><Plus size={13} /> {t("protocols.addFact")}</button>
          </div>
          {(doc.meta.facts || []).map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input style={{ ...inp, width: 70, flexShrink: 0, textAlign: "center", fontWeight: 800 }} value={f.n} onChange={(e) => setFact(i, { n: e.target.value })} placeholder="4" />
              <input style={{ ...inp, flex: 1 }} value={f.label} onChange={(e) => setFact(i, { label: e.target.value })} placeholder={t("protocols.factLabelPh")} />
              <button onClick={() => setFact(i, { accent: cycle(FACT_ACCENTS, f.accent || "c") })} title={t("protocols.accent")} style={{ ...swatch, background: ACC[f.accent] || ACC.c }} />
              <button onClick={() => delFact(i)} title={t("protocols.remove")} style={iconBtn}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Block>

      {/* ── Sections ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "22px 0 10px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{t("protocols.sections")}</div>
        <button onClick={() => addSection("narrative")} style={miniBtn}><Plus size={13} /> {t("protocols.addNarrative")}</button>
        <button onClick={() => addSection("exercises")} style={miniBtn}><Plus size={13} /> {t("protocols.addExercises")}</button>
      </div>

      {doc.sections.length === 0 && (
        <div style={{ textAlign: "center", padding: 22, color: "rgba(255,255,255,0.5)", fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 12 }}>{t("protocols.noSections")}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {doc.sections.map((s, si) => (
          <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            {/* En-tête de section */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: s.type === "narrative" ? C.blue : ACCENT, background: s.type === "narrative" ? `${C.blue}1e` : `${ACCENT}1e`, borderRadius: 6, padding: "3px 7px" }}>
                {s.type === "narrative" ? t("protocols.typeNarrative") : t("protocols.typeExercises")}
              </span>
              <input style={{ ...inp, width: 54, flexShrink: 0, textAlign: "center" }} value={s.num} onChange={(e) => setSection(si, { num: e.target.value })} placeholder="01" />
              <input style={{ ...inp, flex: 1 }} value={s.title} onChange={(e) => setSection(si, { title: e.target.value })} placeholder={t("protocols.sectionTitlePh")} />
              <button onClick={() => moveSection(si, -1)} disabled={si === 0} title={t("protocols.moveUp")} style={{ ...iconBtn, opacity: si === 0 ? 0.35 : 1 }}><ChevronDown size={14} style={{ transform: "rotate(180deg)" }} /></button>
              <button onClick={() => moveSection(si, 1)} disabled={si === doc.sections.length - 1} title={t("protocols.moveDown")} style={{ ...iconBtn, opacity: si === doc.sections.length - 1 ? 0.35 : 1 }}><ChevronDown size={14} /></button>
              <button onClick={() => delSection(si)} title={t("protocols.removeSection")} style={iconBtn}><Trash2 size={14} /></button>
            </div>
            <input style={{ ...inp, marginBottom: 10 }} value={s.subtitle} onChange={(e) => setSection(si, { subtitle: e.target.value })} placeholder={t("protocols.sectionSubtitlePh")} />

            {s.type === "narrative" ? (
              <>
                <textarea style={{ ...inp, minHeight: 130, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} value={s.body} onChange={(e) => setSection(si, { body: e.target.value })} placeholder={t("protocols.bodyPh")} />
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>{t("protocols.markdownHint")}</div>
              </>
            ) : (
              <ExerciseGrid
                section={s} weeks={weeks} t={t}
                onAddFree={() => addRow(si)} onLibrary={() => setPicker(si)}
                onRow={(ri, p) => setRow(si, ri, p)} onCell={(ri, wi, p) => setCell(si, ri, wi, p)}
                onMoveRow={(ri, dir) => moveRow(si, ri, dir)} onDelRow={(ri) => delRow(si, ri)}
                onWeekAccent={(wi) => setWeekAccent(si, wi)} onWeekLabel={(wi, v) => setWeekLabel(si, wi, v)}
              />
            )}
          </div>
        ))}
      </div>

      {picker != null && (
        <ExercisePickerSheet
          onAdd={addFromLibrary}
          onClose={() => setPicker(null)}
          isAdded={(ex) => pickedRefs.has(ex.ref)}
        />
      )}

      {preview && (
        <ProgramView doc={{ ...doc, meta: { ...doc.meta, weeks } }} title={title} onClose={() => setPreview(false)} />
      )}
    </section>
  );
}

/* Grille d'exercices : une ligne par exercice, une cellule éditable par semaine
   (texte libre « 4×8 R7 » + bascule pic ★), + bloc / tempo / repos / note. */
function ExerciseGrid({ section, weeks, t, onAddFree, onLibrary, onRow, onCell, onMoveRow, onDelRow, onWeekAccent, onWeekLabel }) {
  const cellW = 92;
  return (
    <div>
      <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ minWidth: 460 + weeks * cellW }}>
          {/* En-tête colonnes */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${C.border}` }}>
            <HCell w={44}>{t("protocols.colBlock")}</HCell>
            <HCell w={200} grow>{t("protocols.colExercise")}</HCell>
            <HCell w={70}>{t("protocols.colTempo")}</HCell>
            <HCell w={70}>{t("protocols.colRest")}</HCell>
            {section.weekLabels.map((wl, wi) => (
              <div key={wi} style={{ width: cellW, flexShrink: 0, padding: "6px 4px", borderLeft: `1px solid ${C.border}`, textAlign: "center" }}>
                <input value={wl} onChange={(e) => onWeekLabel(wi, e.target.value)} style={{ width: "100%", background: "transparent", border: "none", color: ACC[section.weekAccents[wi]] || ACC.c, fontWeight: 800, fontSize: 11, textAlign: "center", outline: "none" }} />
                <button onClick={() => onWeekAccent(wi)} title={t("protocols.accent")} style={{ ...swatch, width: 14, height: 5, borderRadius: 3, margin: "3px auto 0", background: ACC[section.weekAccents[wi]] || ACC.c }} />
              </div>
            ))}
            <HCell w={150} grow>{t("protocols.colNote")}</HCell>
            <HCell w={38}> </HCell>
          </div>
          {/* Lignes */}
          {section.rows.map((r, ri) => {
            const tint = ACC[r.tint || blockTint(r.block)] || ACC.c;
            return (
              <div key={r.id} style={{ display: "flex", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ width: 44, flexShrink: 0, borderLeft: `3px solid ${tint}` }}>
                  <input value={r.block} onChange={(e) => onRow(ri, { block: e.target.value })} placeholder="A1" style={{ ...cellInput, textAlign: "center", fontWeight: 700 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center" }}>
                  {r.exerciseRef && <span title={t("protocols.linked")} style={{ fontSize: 11, marginLeft: 6, color: C.green, flexShrink: 0 }}>🔗</span>}
                  <input value={r.name} onChange={(e) => onRow(ri, { name: e.target.value })} placeholder={t("protocols.exercisePh")} style={cellInput} />
                </div>
                <input value={r.tempo} onChange={(e) => onRow(ri, { tempo: e.target.value })} placeholder="2010" style={{ ...cellInput, width: 70, flexShrink: 0, borderLeft: `1px solid ${C.border2}` }} />
                <input value={r.rest} onChange={(e) => onRow(ri, { rest: e.target.value })} placeholder="90s" style={{ ...cellInput, width: 70, flexShrink: 0, borderLeft: `1px solid ${C.border2}` }} />
                {r.weeks.map((cell, wi) => (
                  <div key={wi} style={{ width: cellW, flexShrink: 0, borderLeft: `1px solid ${C.border2}`, display: "flex", alignItems: "center" }}>
                    <input value={cell.text} onChange={(e) => onCell(ri, wi, { text: e.target.value })} placeholder="4×8 R7" style={{ ...cellInput, padding: "8px 4px 8px 6px" }} />
                    <button onClick={() => onCell(ri, wi, { peak: !cell.peak })} title={t("protocols.peak")} style={{ background: "none", border: "none", cursor: "pointer", color: cell.peak ? C.amb : "rgba(255,255,255,0.25)", fontSize: 13, padding: "0 4px", flexShrink: 0 }}>★</button>
                  </div>
                ))}
                <input value={r.note} onChange={(e) => onRow(ri, { note: e.target.value })} placeholder={t("protocols.notePh")} style={{ ...cellInput, flex: 1, minWidth: 150, borderLeft: `1px solid ${C.border2}` }} />
                <div style={{ width: 38, flexShrink: 0, display: "flex", flexDirection: "column", borderLeft: `1px solid ${C.border2}` }}>
                  <button onClick={() => onMoveRow(ri, -1)} disabled={ri === 0} title={t("protocols.moveUp")} style={{ ...rowMini, opacity: ri === 0 ? 0.3 : 1 }}><ChevronDown size={11} style={{ transform: "rotate(180deg)" }} /></button>
                  <button onClick={() => onMoveRow(ri, 1)} disabled={ri === section.rows.length - 1} title={t("protocols.moveDown")} style={{ ...rowMini, opacity: ri === section.rows.length - 1 ? 0.3 : 1 }}><ChevronDown size={11} /></button>
                  <button onClick={() => onDelRow(ri)} title={t("protocols.removeRow")} style={{ ...rowMini, color: C.coral }}><Trash2 size={11} /></button>
                </div>
              </div>
            );
          })}
          {section.rows.length === 0 && (
            <div style={{ padding: 14, textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>{t("protocols.noRows")}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onAddFree} style={miniBtn}><Plus size={13} /> {t("protocols.addRowFree")}</button>
        <button onClick={onLibrary} style={{ ...miniBtn, borderColor: `${C.green}66`, color: C.green }}><Search size={13} /> {t("protocols.addFromLibrary")}</button>
      </div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.3, marginBottom: 12, color: "rgba(255,255,255,0.9)" }}>{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 10 }}><span style={lbl}>{label}</span>{children}</div>;
}
function HCell({ w, grow, children }) {
  return <div style={{ width: w, flex: grow ? 1 : "none", minWidth: w, flexShrink: 0, padding: "8px 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{children}</div>;
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const iconBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 8, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", flexShrink: 0 };
const miniBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 11px", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700 };
const swatch = { width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, cursor: "pointer", flexShrink: 0 };
const cellInput = { width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 12, padding: "8px 8px", outline: "none", fontFamily: "inherit" };
const rowMini = { flex: 1, background: "none", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
