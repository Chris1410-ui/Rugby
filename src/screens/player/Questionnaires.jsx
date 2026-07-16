import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { fmtShort } from "../../lib/metrics.js";
import { Tag, Section } from "../../lib/ui.jsx";
import { ClipboardList, CheckCircle, Plus, X } from "../../lib/icons.jsx";
import { usePreview } from "../../lib/preview.js";
import { useMyQuestionnaires, submitQuestionnaire } from "../../data/questionnaires.js";

/* « Questionnaires » (joueur) : liste à remplir + formulaire dédié (6 types de
   questions). Soumission via RPC. Lecture seule en mode aperçu. */
export default function Questionnaires({ me, accent = C.green }) {
  const preview = usePreview();
  const { list } = useMyQuestionnaires(me.id);
  const [open, setOpen] = useState(null); // questionnaireId en cours de remplissage

  const todo = list.filter((a) => a.statut !== "rempli");
  const done = list.filter((a) => a.statut === "rempli");

  if (open) {
    const a = list.find((x) => x.questionnaire.id === open);
    if (a) return <FillForm assignment={a} preview={preview} accent={accent} onClose={() => setOpen(null)} />;
  }

  const Card = (a) => (
    <div key={a.questionnaire.id} style={sc({ marginBottom: 10, padding: 14, borderLeft: `3px solid ${a.statut === "rempli" ? C.green : accent}` })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{a.questionnaire.nom}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{a.questionnaire.questions.length} question{a.questionnaire.questions.length > 1 ? "s" : ""} · reçu le {fmtShort(a.sentAt)}</div>
        </div>
        {a.statut === "rempli" ? <Tag c={C.green}>✓ Rempli</Tag> : (
          <button onClick={() => setOpen(a.questionnaire.id)} style={{ background: accent, border: "none", borderRadius: 9, padding: "8px 13px", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Remplir</button>
        )}
      </div>
      {a.statut === "rempli" && <button onClick={() => setOpen(a.questionnaire.id)} style={{ marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Revoir / modifier</button>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>Questionnaires</div>
      </div>
      {list.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          Aucun questionnaire pour le moment.<br />Ton staff t'en enverra ici (santé, profil…).
        </div>
      ) : (
        <>
          {todo.length > 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>À REMPLIR · {todo.length}</div>}
          {todo.map(Card)}
          {done.length > 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 1, fontWeight: 700, margin: "16px 0 10px" }}>REMPLIS</div>}
          {done.map(Card)}
        </>
      )}
    </div>
  );
}

function FillForm({ assignment, preview, accent, onClose }) {
  const q = assignment.questionnaire;
  const [ans, setAns] = useState(() => ({ ...(assignment.reponses || {}) }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const set = (qid, v) => setAns((a) => ({ ...a, [qid]: v }));

  const submit = async () => {
    if (preview) return;
    setBusy(true); setNote("");
    try { await submitQuestionnaire(q.id, ans); setNote("ok"); setTimeout(onClose, 500); }
    catch (e) { setNote("Échec : " + (e.message || "réessaie.")); setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1, minWidth: 0 }}>{q.nom}</div>
      </div>

      {q.questions.map((question) => (
        <Section key={question.id} title={question.label.toUpperCase()}>
          <QuestionInput q={question} value={ans[question.id]} onChange={(v) => set(question.id, v)} accent={accent} disabled={preview} />
        </Section>
      ))}

      {note && note !== "ok" && <div style={{ fontSize: 12, color: C.coral, textAlign: "center", marginBottom: 8 }}>{note}</div>}
      <button onClick={submit} disabled={preview || busy} style={{ width: "100%", background: preview ? "rgba(255,255,255,0.06)" : accent, border: "none", borderRadius: 12, padding: 14, color: preview ? "rgba(255,255,255,0.5)" : "#fff", fontWeight: 800, fontSize: 14, cursor: preview ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20, opacity: busy ? 0.7 : 1 }}>
        <CheckCircle size={16} /> {preview ? "Aperçu — lecture seule" : busy ? "Envoi…" : "Envoyer mes réponses"}
      </button>
    </div>
  );
}

/* Rendu d'une question selon son type (réutilisé). */
export function QuestionInput({ q, value, onChange, accent = C.green, disabled }) {
  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 14, outline: "none" };
  const pill = (on) => ({ padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer" });

  if (q.type === "scale") {
    const v = value ?? 5;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>1</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{v}/10</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>10</span>
        </div>
        <input type="range" min="1" max="10" value={v} disabled={disabled} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: accent }} />
      </div>
    );
  }
  if (q.type === "yesno") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => !disabled && onChange(true)} style={pill(value === true)}>Oui</button>
        <button onClick={() => !disabled && onChange(false)} style={pill(value === false)}>Non</button>
      </div>
    );
  }
  if (q.type === "choice") {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(q.options || []).map((o) => <button key={o} onClick={() => !disabled && onChange(o)} style={pill(value === o)}>{o}</button>)}
      </div>
    );
  }
  if (q.type === "number") {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <input type="number" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} style={{ ...inp, maxWidth: 160 }} />
        {q.unit && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{q.unit}</span>}
      </div>
    );
  }
  if (q.type === "repeat") {
    const rows = Array.isArray(value) ? value : [];
    const setRow = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
    const add = () => onChange([...rows, {}]);
    const del = (i) => onChange(rows.filter((_, j) => j !== i));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>#{i + 1}</span>
              {!disabled && <X size={15} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={() => del(i)} />}
            </div>
            {(q.fields || []).map((f) => (
              <div key={f.key} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>{f.label}</div>
                {f.type === "yesno" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => !disabled && setRow(i, f.key, true)} style={{ ...pill(r[f.key] === true), padding: "5px 12px", fontSize: 12 }}>Oui</button>
                    <button onClick={() => !disabled && setRow(i, f.key, false)} style={{ ...pill(r[f.key] === false), padding: "5px 12px", fontSize: 12 }}>Non</button>
                  </div>
                ) : (
                  <input type={f.type === "number" ? "number" : "text"} value={r[f.key] ?? ""} disabled={disabled} onChange={(e) => setRow(i, f.key, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} style={inp} />
                )}
              </div>
            ))}
          </div>
        ))}
        {!disabled && <button onClick={add} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, alignSelf: "flex-start" }}><Plus size={13} /> Ajouter</button>}
        {rows.length === 0 && disabled && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>—</div>}
      </div>
    );
  }
  // text
  return <textarea value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="Ta réponse…" style={{ ...inp, height: 60, resize: "none" }} />;
}
