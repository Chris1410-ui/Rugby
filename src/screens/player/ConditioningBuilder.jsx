import { useState } from "react";
import { C } from "../../lib/tokens.js";
import { Trash2, Plus } from "../../lib/icons.jsx";
import { computeTargetPace, formatPace } from "../../lib/pace.js";

/* Builder « liste de blocs » du conditioning (séance libre). Un bloc = un format
   (continu / intervalles). Produit directement la forme attendue par le
   normaliseur (freeSessions.NORMALIZERS) : kind + champs propres. Gated derrière
   le flag ENABLED_TYPES jusqu'à PR3b-2 (exposition avec circuit/test/mixte). */

const uid = () => (globalThis.crypto?.randomUUID?.() || `b${Math.random().toString(36).slice(2, 9)}`);
const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12.5, outline: "none", boxSizing: "border-box" };
const lbl = { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, display: "block", marginBottom: 3 };
const num = (v) => v.replace(/[^\d]/g, "");

export default function ConditioningBuilder({ blocks, setBlocks, masKmh, t, accent = C.green }) {
  const [adding, setAdding] = useState(false);
  const add = (kind) => {
    const base = { id: uid(), kind, name: "", note: "", pctVMA: "" };
    setBlocks([...blocks, kind === "cardio_continuous"
      ? { ...base, distanceM: "", durationSec: 0, hrTarget: "" }
      : { ...base, reps: "8", effort: { durationSec: 30 }, recovery: { durationSec: 30 }, repPlan: null }]);
    setAdding(false);
  };
  const patch = (id, p) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const remove = (id) => setBlocks(blocks.filter((b) => b.id !== id));

  return (
    <div>
      {blocks.map((b) => (b.kind === "cardio_continuous"
        ? <ContinuEditor key={b.id} b={b} onPatch={(p) => patch(b.id, p)} onRemove={() => remove(b.id)} masKmh={masKmh} t={t} accent={accent} />
        : <IntervalEditor key={b.id} b={b} onPatch={(p) => patch(b.id, p)} onRemove={() => remove(b.id)} masKmh={masKmh} t={t} accent={accent} />))}

      {adding ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => add("cardio_continuous")} style={fmtBtn}>{t("player.freeSession.cond.continuous")}</button>
          <button onClick={() => add("cardio_interval")} style={fmtBtn}>{t("player.freeSession.cond.interval")}</button>
          <button onClick={() => setAdding(false)} style={{ ...fmtBtn, color: "rgba(255,255,255,0.6)" }}>{t("common.cancel")}</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 12, color: accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Plus size={15} /> {t("player.freeSession.cond.addBlock")}
        </button>
      )}
    </div>
  );
}

const fmtBtn = { flex: 1, minWidth: 90, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" };

function BlockShell({ title, onRemove, children, note, onNote, t }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>{title}</span>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex" }}><Trash2 size={15} /></button>
      </div>
      {children}
      <input value={note} onChange={(e) => onNote(e.target.value)} placeholder={t("player.freeSession.cond.note")} style={{ ...inp, marginTop: 8 }} />
    </div>
  );
}

// Widget durée min:sec ↔ durationSec.
function DurationField({ label, sec, onChange, t }) {
  const s = Number(sec) || 0;
  return (
    <label style={{ display: "block" }}>
      <span style={lbl}>{label}</span>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        <input value={s ? Math.floor(s / 60) : ""} onChange={(e) => onChange((Number(num(e.target.value)) || 0) * 60 + (s % 60))} inputMode="numeric" placeholder={t("player.session.min")} style={{ ...inp, textAlign: "center" }} />
        <span style={{ color: "rgba(255,255,255,0.4)" }}>:</span>
        <input value={s ? String(s % 60).padStart(2, "0") : ""} onChange={(e) => onChange(Math.floor(s / 60) * 60 + (Number(num(e.target.value)) || 0))} inputMode="numeric" placeholder={t("player.session.ssHint")} style={{ ...inp, textAlign: "center" }} />
      </div>
    </label>
  );
}

// Widget effort/récup : valeur + bascule unité (s / m) → { durationSec } | { distanceM }.
function SpanField({ label, spec, onChange }) {
  const mode = spec?.distanceM != null ? "m" : "s";
  const val = spec?.distanceM ?? spec?.durationSec ?? "";
  const setMode = (mo) => onChange(mo === "m" ? { distanceM: Number(val) || 0 } : { durationSec: Number(val) || 0 });
  const setVal = (v) => onChange(mode === "m" ? { distanceM: Number(num(v)) || 0 } : { durationSec: Number(num(v)) || 0 });
  return (
    <label style={{ display: "block" }}>
      <span style={lbl}>{label}</span>
      <div style={{ display: "flex", gap: 3 }}>
        <input value={val || ""} onChange={(e) => setVal(e.target.value)} inputMode="numeric" style={{ ...inp, textAlign: "center" }} />
        <div style={{ display: "flex" }}>
          {["s", "m"].map((mo) => (
            <button key={mo} onClick={() => setMode(mo)} style={{ padding: "0 8px", border: `1px solid ${C.border}`, background: mode === mo ? "rgba(139,124,246,0.25)" : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: mo === "s" ? "6px 0 0 6px" : "0 6px 6px 0" }}>{mo}</button>
          ))}
        </div>
      </div>
    </label>
  );
}

function PacePreview({ pctVMA, masKmh, t }) {
  if (!(Number(pctVMA) > 0)) return null;
  const tp = computeTargetPace(pctVMA, masKmh);
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 6, color: tp.needsMas ? C.amb : C.viol }}>
      {tp.needsMas ? t("player.session.cardio.noMas") : `${t("player.freeSession.cond.targetPace")} ${formatPace(tp.secPerKm)}/km`}
    </div>
  );
}

function ContinuEditor({ b, onPatch, onRemove, masKmh, t }) {
  return (
    <BlockShell title={t("player.freeSession.cond.continuous")} onRemove={onRemove} note={b.note} onNote={(v) => onPatch({ note: v })} t={t}>
      <input value={b.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder={t("player.freeSession.cond.name")} style={{ ...inp, marginBottom: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.8fr", gap: 6, alignItems: "end" }}>
        <label><span style={lbl}>{t("player.freeSession.cond.distanceM")}</span><input value={b.distanceM} onChange={(e) => onPatch({ distanceM: num(e.target.value) })} inputMode="numeric" style={{ ...inp, textAlign: "center" }} /></label>
        <DurationField label={t("player.freeSession.cond.duration")} sec={b.durationSec} onChange={(v) => onPatch({ durationSec: v })} t={t} />
        <label><span style={lbl}>{t("player.freeSession.cond.pctVMA")}</span><input value={b.pctVMA} onChange={(e) => onPatch({ pctVMA: num(e.target.value) })} inputMode="numeric" style={{ ...inp, textAlign: "center" }} /></label>
      </div>
      <PacePreview pctVMA={b.pctVMA} masKmh={masKmh} t={t} />
    </BlockShell>
  );
}

function IntervalEditor({ b, onPatch, onRemove, masKmh, t }) {
  const vary = Array.isArray(b.repPlan);
  const n = Math.max(1, Number(b.reps) || 1);
  const toggleVary = () => onPatch({ repPlan: vary ? null : Array.from({ length: n }, () => ({ effort: { ...b.effort }, recovery: { ...b.recovery }, pctVMA: b.pctVMA })) });
  const patchRep = (i, p) => onPatch({ repPlan: b.repPlan.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <BlockShell title={t("player.freeSession.cond.interval")} onRemove={onRemove} note={b.note} onNote={(v) => onPatch({ note: v })} t={t}>
      <input value={b.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder={t("player.freeSession.cond.name")} style={{ ...inp, marginBottom: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 0.8fr", gap: 6, alignItems: "end" }}>
        <label><span style={lbl}>{t("player.freeSession.cond.reps")}</span><input value={b.reps} onChange={(e) => onPatch({ reps: num(e.target.value) })} inputMode="numeric" style={{ ...inp, textAlign: "center" }} /></label>
        <SpanField label={t("player.freeSession.cond.effort")} spec={b.effort} onChange={(v) => onPatch({ effort: v })} t={t} />
        <SpanField label={t("player.freeSession.cond.recovery")} spec={b.recovery} onChange={(v) => onPatch({ recovery: v })} t={t} />
        <label><span style={lbl}>{t("player.freeSession.cond.pctVMA")}</span><input value={b.pctVMA} onChange={(e) => onPatch({ pctVMA: num(e.target.value) })} inputMode="numeric" style={{ ...inp, textAlign: "center" }} /></label>
      </div>
      <PacePreview pctVMA={b.pctVMA} masKmh={masKmh} t={t} />
      <button onClick={toggleVary} style={{ background: "none", border: "none", color: C.viol, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: "6px 0 0" }}>
        {vary ? t("player.freeSession.cond.varyOff") : t("player.freeSession.cond.varyOn")}
      </button>
      {vary && b.repPlan.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 0.7fr", gap: 5, alignItems: "end", marginTop: 5 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, paddingBottom: 8 }}>{t("player.session.seriesN", { n: i + 1 })}</span>
          <SpanField label={t("player.freeSession.cond.effort")} spec={r.effort} onChange={(v) => patchRep(i, { effort: v })} t={t} />
          <SpanField label={t("player.freeSession.cond.recovery")} spec={r.recovery} onChange={(v) => patchRep(i, { recovery: v })} t={t} />
          <label><span style={lbl}>{t("player.freeSession.cond.pctVMA")}</span><input value={r.pctVMA ?? ""} onChange={(e) => patchRep(i, { pctVMA: num(e.target.value) })} inputMode="numeric" style={{ ...inp, textAlign: "center" }} /></label>
        </div>
      ))}
    </BlockShell>
  );
}
