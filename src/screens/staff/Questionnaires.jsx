import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { Section, Tag, CloseX, useModalClose } from "../../lib/ui.jsx";
import { ClipboardList, Plus, X, Trash2, Send } from "../../lib/icons.jsx";
import { QUESTION_BANK, QCATS, QTYPES, bankById, newQid } from "../../lib/questionnaires.js";
import { resolveAssignedIds } from "../../data/sessions.js";
import { useTeamQuestionnaires, useTeamAssignments, createQuestionnaire, updateQuestionnaire, deleteQuestionnaire, sendQuestionnaire } from "../../data/questionnaires.js";
import QuestionnaireResponses from "./QuestionnaireResponses.jsx";
import { useReadOnly } from "../../lib/readonly.js";

const accent = C.coral;

/* Onglet « Questionnaires » (staff/owner) : composer des modèles réutilisables,
   les envoyer, suivre qui a rempli, consulter les réponses. */
export default function Questionnaires({ teamId, players = [], openNew = false }) {
  const readOnly = useReadOnly();
  const { questionnaires } = useTeamQuestionnaires(teamId);
  const { byQuestionnaire } = useTeamAssignments(teamId);
  const [edit, setEdit] = useState(openNew && !readOnly ? "new" : null);   // 'new' | questionnaire (FAB → éditeur ouvert)
  const [send, setSend] = useState(null);   // questionnaire à envoyer
  const [responses, setResponses] = useState(null); // questionnaire dont on voit les réponses

  if (responses) return <QuestionnaireResponses questionnaire={responses} players={players} assignments={byQuestionnaire[responses.id] || {}} onBack={() => setResponses(null)} />;
  if (edit) return <QEditor teamId={teamId} initial={edit === "new" ? null : edit} onDone={() => setEdit(null)} onCancel={() => setEdit(null)} />;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Questionnaires · {questionnaires.length}</div>
        {!readOnly && <button onClick={() => setEdit("new")} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nouveau</button>}
      </div>

      {questionnaires.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6 })}>
          Aucun questionnaire. Compose un modèle (santé, profil…) depuis la banque de questions, puis envoie-le aux joueurs.
        </div>
      ) : (
        questionnaires.map((q) => {
          const asg = byQuestionnaire[q.id] || {};
          const sent = Object.keys(asg).length;
          const filled = Object.values(asg).filter((a) => a.statut === "rempli").length;
          return (
            <div key={q.id} style={sc({ marginBottom: 10, padding: 14 })}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{q.nom}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{q.questions.length} question{q.questions.length > 1 ? "s" : ""}{sent > 0 ? ` · ${filled}/${sent} rempli(s)` : " · non envoyé"}</div>
                </div>
                {!readOnly && <button onClick={() => setEdit(q)} title="Modifier" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Modifier</button>}
                {!readOnly && <button onClick={() => deleteQuestionnaire(q.id).catch((e) => console.error(e.message))} title="Supprimer" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {!readOnly && <button onClick={() => setSend(q)} style={{ flex: 1, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 9, padding: 9, color: accent, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Send size={13} /> Envoyer</button>}
                <button onClick={() => setResponses(q)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Réponses{sent > 0 ? ` (${filled}/${sent})` : ""}</button>
              </div>
            </div>
          );
        })
      )}

      {send && <SendModal questionnaire={send} teamId={teamId} players={players} onClose={() => setSend(null)} />}
    </section>
  );
}

/* Éditeur : nom + sélection depuis la banque + questions custom. */
function QEditor({ teamId, initial, onDone, onCancel }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [questions, setQuestions] = useState(initial?.questions || []);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const has = (id) => questions.some((q) => q.id === id);
  const toggleBank = (bq) => setQuestions((qs) => has(bq.id) ? qs.filter((q) => q.id !== bq.id) : [...qs, { ...bq }]);
  const removeQ = (id) => setQuestions((qs) => qs.filter((q) => q.id !== id));

  const save = async () => {
    if (!nom.trim()) return setErr("Donne un nom au questionnaire.");
    if (questions.length === 0) return setErr("Ajoute au moins une question.");
    setBusy(true); setErr("");
    try {
      if (initial) await updateQuestionnaire(initial.id, { nom, questions });
      else await createQuestionnaire(teamId, { nom, questions });
      onDone();
    } catch (e) { setErr("Échec : " + (e.message || "")); setBusy(false); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{initial ? "Modifier" : "Nouveau"} questionnaire</div>
      </div>

      <input value={nom} onChange={(e) => { setNom(e.target.value); setErr(""); }} placeholder="Nom (ex. Bilan santé de rentrée)" maxLength={80} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 12 }} />

      <Section title={`QUESTIONS CHOISIES · ${questions.length}`}>
        {questions.length === 0 ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Aucune. Choisis-en dans la banque ci-dessous.</div> : questions.map((q) => (
          <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{q.label}</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{QTYPES[q.type]?.label}{!bankById[q.id] ? " · custom" : ""}</div>
            </div>
            <X size={16} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={() => removeQ(q.id)} />
          </div>
        ))}
      </Section>

      {QCATS.map((cat) => (
        <Section key={cat.key} title={`BANQUE · ${cat.label.toUpperCase()}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUESTION_BANK.filter((q) => q.cat === cat.key).map((bq) => (
              <button key={bq.id} onClick={() => toggleBank(bq)} style={{ padding: "6px 11px", borderRadius: 20, border: `1px solid ${has(bq.id) ? accent : C.border}`, background: has(bq.id) ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {has(bq.id) ? "✓ " : "+ "}{bq.label}
              </button>
            ))}
          </div>
        </Section>
      ))}

      {adding ? <CustomQuestion onAdd={(q) => { setQuestions((qs) => [...qs, q]); setAdding(false); }} onCancel={() => setAdding(false)} />
        : <button onClick={() => setAdding(true)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 12 }}>+ Question personnalisée</button>}

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 14, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1, marginBottom: 20 }}>{busy ? "…" : initial ? "Enregistrer le modèle" : "Créer le modèle"}</button>
    </section>
  );
}

function CustomQuestion({ onAdd, onCancel }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("scale");
  const [opts, setOpts] = useState("");
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", marginBottom: 8 };
  const add = () => {
    if (!label.trim()) return;
    const q = { id: newQid(), cat: "custom", type, label: label.trim() };
    if (type === "choice") q.options = opts.split(",").map((s) => s.trim()).filter(Boolean);
    onAdd(q);
  };
  return (
    <div style={sc({ padding: 12, marginBottom: 12 })}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Intitulé de la question" style={inp} />
      <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inp, colorScheme: "dark" }}>
        {Object.entries(QTYPES).filter(([k]) => k !== "repeat").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      {type === "choice" && <input value={opts} onChange={(e) => setOpts(e.target.value)} placeholder="Options séparées par des virgules" style={inp} />}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={add} style={{ flex: 1, background: accent, border: "none", borderRadius: 8, padding: 9, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Ajouter</button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "9px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Annuler</button>
      </div>
    </div>
  );
}

function SendModal({ questionnaire, teamId, players, onClose }) {
  useModalClose(onClose);
  const [mode, setMode] = useState("all");
  const [group, setGroup] = useState("");
  const [ids, setIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const grps = [...new Set(players.map((p) => p.grp).filter(Boolean))];
  const toggle = (id) => setIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);

  const doSend = async () => {
    const assigned = mode === "group" ? { mode: "group", group: group || grps[0] } : mode === "players" ? { mode: "players", ids } : { mode: "all" };
    const targetIds = resolveAssignedIds(assigned, players);
    if (targetIds.length === 0) return setNote("Aucun destinataire.");
    setBusy(true); setNote("");
    try { await sendQuestionnaire(questionnaire.id, teamId, targetIds); setNote(`Envoyé à ${targetIds.length} joueur(s) ✓`); setTimeout(onClose, 800); }
    catch (e) { setNote("Échec : " + (e.message || "")); setBusy(false); }
  };

  const pill = (on) => ({ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: on ? accent : "rgba(255,255,255,0.07)", color: "#fff" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Envoyer « {questionnaire.nom} »</div>
          <CloseX onClose={onClose} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, marginBottom: 6 }}>DESTINATAIRES</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[["all", "Toute l'équipe"], ["group", "Une ligne"], ["players", "Joueurs choisis"]].map(([v, l]) => <button key={v} onClick={() => setMode(v)} style={pill(mode === v)}>{l}</button>)}
        </div>
        {mode === "group" && (
          <select value={group || grps[0] || ""} onChange={(e) => setGroup(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", marginBottom: 10 }}>
            {grps.map((g) => <option key={g} value={g}>{grpLabel(g)}</option>)}
          </select>
        )}
        {mode === "players" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
            {players.map((p) => <button key={p.id} onClick={() => toggle(p.id)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${ids.includes(p.id) ? accent : C.border}`, background: ids.includes(p.id) ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{p.name}</button>)}
          </div>
        )}
        {note && <div style={{ fontSize: 12, marginBottom: 10, color: note.startsWith("Envoyé") ? C.green : C.amb }}>{note}</div>}
        <button onClick={doSend} disabled={busy || (mode === "players" && ids.length === 0)} style={{ width: "100%", background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Send size={14} /> Envoyer</button>
      </div>
    </div>
  );
}
