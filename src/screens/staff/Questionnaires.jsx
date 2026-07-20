import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { Section, Tag, CloseX, useModalClose } from "../../lib/ui.jsx";
import { ClipboardList, Plus, X, Trash2, Send, Bell } from "../../lib/icons.jsx";
import { QUESTION_BANK, QCATS, QTYPES, bankById, newQid } from "../../lib/questionnaires.js";
import { resolveAssignedIds } from "../../data/sessions.js";
import { useTeamQuestionnaires, useTeamAssignments, createQuestionnaire, updateQuestionnaire, deleteQuestionnaire, sendQuestionnaire, remindQuestionnaire } from "../../data/questionnaires.js";
import QuestionnaireResponses from "./QuestionnaireResponses.jsx";
import { useReadOnly } from "../../lib/readonly.js";

const accent = C.coral;

/* Onglet « Questionnaires » (staff/owner) : composer des modèles réutilisables,
   les envoyer, suivre qui a rempli, consulter les réponses. */
export default function Questionnaires({ teamId, players = [], openNew = false }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { questionnaires } = useTeamQuestionnaires(teamId);
  const { byQuestionnaire } = useTeamAssignments(teamId);
  const [edit, setEdit] = useState(openNew && !readOnly ? "new" : null);   // 'new' | questionnaire (FAB → éditeur ouvert)
  const [send, setSend] = useState(null);   // questionnaire à envoyer
  const [responses, setResponses] = useState(null); // questionnaire dont on voit les réponses
  const [flash, setFlash] = useState("");   // message de confirmation (rappel envoyé)
  const [reminding, setReminding] = useState(null); // id du questionnaire en cours de relance

  const remind = async (q, missing) => {
    if (readOnly || reminding) return;
    if (!confirm(t("staff.questionnaires.remindConfirm", { count: missing, name: q.nom }))) return;
    setReminding(q.id); setFlash("");
    try {
      const n = await remindQuestionnaire(q.id);
      setFlash(t("staff.questionnaires.remindSent", { count: n, name: q.nom }));
    } catch (e) { setFlash(t("staff.questionnaires.remindFail", { err: e.message || "" })); }
    finally { setReminding(null); setTimeout(() => setFlash(""), 4000); }
  };

  if (responses) return <QuestionnaireResponses questionnaire={responses} players={players} assignments={byQuestionnaire[responses.id] || {}} onBack={() => setResponses(null)} />;
  if (edit) return <QEditor teamId={teamId} initial={edit === "new" ? null : edit} onDone={() => setEdit(null)} onCancel={() => setEdit(null)} />;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.questionnaires.title", { count: questionnaires.length })}</div>
        {!readOnly && <button onClick={() => setEdit("new")} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("staff.questionnaires.new")}</button>}
      </div>

      {flash && <div style={{ background: flash.startsWith("🔔") ? `${C.green}18` : `${C.coral}18`, border: `1px solid ${flash.startsWith("🔔") ? C.green : C.coral}55`, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, color: flash.startsWith("🔔") ? C.green : C.coral, marginBottom: 10 }}>{flash}</div>}

      {questionnaires.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6 })}>
          {t("staff.questionnaires.empty")}
        </div>
      ) : (
        questionnaires.map((q) => {
          const asg = byQuestionnaire[q.id] || {};
          const sent = Object.keys(asg).length;
          const filled = Object.values(asg).filter((a) => a.statut === "rempli").length;
          const missing = sent - filled;
          return (
            <div key={q.id} style={sc({ marginBottom: 10, padding: 14 })}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{q.nom}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("staff.questionnaires.questions", { count: q.questions.length })}{sent > 0 ? t("staff.questionnaires.filledSuffix", { filled, sent }) : t("staff.questionnaires.notSentSuffix")}</div>
                </div>
                {!readOnly && <button onClick={() => setEdit(q)} title={t("staff.questionnaires.editTitle")} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t("staff.questionnaires.editTitle")}</button>}
                {!readOnly && <button onClick={() => deleteQuestionnaire(q.id).catch((e) => console.error(e.message))} title={t("staff.questionnaires.deleteTitle")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {!readOnly && <button onClick={() => setSend(q)} style={{ flex: 1, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 9, padding: 9, color: accent, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Send size={13} /> {t("staff.questionnaires.send")}</button>}
                <button onClick={() => setResponses(q)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 9, color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("staff.questionnaires.responses")}{sent > 0 ? t("staff.questionnaires.responsesSuffix", { filled, sent }) : ""}</button>
              </div>
              {!readOnly && missing > 0 && (
                <button onClick={() => remind(q, missing)} disabled={reminding === q.id} style={{ width: "100%", marginTop: 8, background: `${C.amb}1c`, border: `1px solid ${C.amb}66`, borderRadius: 9, padding: 9, color: C.amb, fontWeight: 800, fontSize: 12, cursor: "pointer", opacity: reminding === q.id ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Bell size={13} /> {reminding === q.id ? t("staff.questionnaires.sending") : t("staff.questionnaires.remindBtn", { count: missing })}
                </button>
              )}
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
  const { t } = useTranslation();
  const [nom, setNom] = useState(initial?.nom || "");
  const [questions, setQuestions] = useState(initial?.questions || []);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const has = (id) => questions.some((q) => q.id === id);
  const toggleBank = (bq) => setQuestions((qs) => has(bq.id) ? qs.filter((q) => q.id !== bq.id) : [...qs, { ...bq }]);
  const removeQ = (id) => setQuestions((qs) => qs.filter((q) => q.id !== id));

  const save = async () => {
    if (!nom.trim()) return setErr(t("staff.questionnaires.errName"));
    if (questions.length === 0) return setErr(t("staff.questionnaires.errNoQuestion"));
    setBusy(true); setErr("");
    try {
      if (initial) await updateQuestionnaire(initial.id, { nom, questions });
      else await createQuestionnaire(teamId, { nom, questions });
      onDone();
    } catch (e) { setErr(t("staff.questionnaires.errSave", { err: e.message || "" })); setBusy(false); }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 11px", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← {t("staff.questionnaires.back")}</button>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{initial ? t("staff.questionnaires.editorTitleEdit") : t("staff.questionnaires.editorTitleNew")}</div>
      </div>

      <input value={nom} onChange={(e) => { setNom(e.target.value); setErr(""); }} placeholder={t("staff.questionnaires.namePlaceholder")} maxLength={80} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 12 }} />

      <Section title={t("staff.questionnaires.chosenQuestions", { count: questions.length })}>
        {questions.length === 0 ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("staff.questionnaires.chosenEmpty")}</div> : questions.map((q) => (
          <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{q.label}</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{QTYPES[q.type]?.label}{!bankById[q.id] ? t("staff.questionnaires.customSuffix") : ""}</div>
            </div>
            <X size={16} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={() => removeQ(q.id)} />
          </div>
        ))}
      </Section>

      {QCATS.map((cat) => (
        <Section key={cat.key} title={t("staff.questionnaires.bankTitle", { cat: cat.label.toUpperCase() })}>
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
        : <button onClick={() => setAdding(true)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 12 }}>{t("staff.questionnaires.customQuestion")}</button>}

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 14, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1, marginBottom: 20 }}>{busy ? "…" : initial ? t("staff.questionnaires.saveEdit") : t("staff.questionnaires.saveNew")}</button>
    </section>
  );
}

function CustomQuestion({ onAdd, onCancel }) {
  const { t } = useTranslation();
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
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("staff.questionnaires.labelPlaceholder")} style={inp} />
      <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inp, colorScheme: "dark" }}>
        {Object.entries(QTYPES).filter(([k]) => k !== "repeat").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      {type === "choice" && <input value={opts} onChange={(e) => setOpts(e.target.value)} placeholder={t("staff.questionnaires.optsPlaceholder")} style={inp} />}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={add} style={{ flex: 1, background: accent, border: "none", borderRadius: 8, padding: 9, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("staff.questionnaires.add")}</button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "9px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

function SendModal({ questionnaire, teamId, players, onClose }) {
  const { t } = useTranslation();
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
    if (targetIds.length === 0) return setNote(t("staff.questionnaires.noRecipient"));
    setBusy(true); setNote("");
    try { await sendQuestionnaire(questionnaire.id, teamId, targetIds); setNote(t("staff.questionnaires.sent", { count: targetIds.length })); setTimeout(onClose, 800); }
    catch (e) { setNote(t("staff.questionnaires.sendErr", { err: e.message || "" })); setBusy(false); }
  };

  const pill = (on) => ({ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: on ? accent : "rgba(255,255,255,0.07)", color: "#fff" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.panel, borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{t("staff.questionnaires.sendTitle", { name: questionnaire.nom })}</div>
          <CloseX onClose={onClose} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, marginBottom: 6 }}>{t("staff.questionnaires.recipients")}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[["all", t("staff.questionnaires.destAll")], ["group", t("staff.questionnaires.destGroup")], ["players", t("staff.questionnaires.destPlayers")]].map(([v, l]) => <button key={v} onClick={() => setMode(v)} style={pill(mode === v)}>{l}</button>)}
        </div>
        {mode === "group" && (
          <select value={group || grps[0] || ""} onChange={(e) => setGroup(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", marginBottom: 10 }}>
            {grps.map((g) => <option key={g} value={g}>{grpLabel(g)}</option>)}
          </select>
        )}
        {mode === "players" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
            {players.map((p) => <button key={p.id} onClick={() => toggle(p.id)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${ids.includes(p.id) ? accent : C.border}`, background: ids.includes(p.id) ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{displayName(p)}</button>)}
          </div>
        )}
        {note && <div style={{ fontSize: 12, marginBottom: 10, color: note.includes("✓") ? C.green : C.amb }}>{note}</div>}
        <button onClick={doSend} disabled={busy || (mode === "players" && ids.length === 0)} style={{ width: "100%", background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Send size={14} /> {t("staff.questionnaires.send")}</button>
      </div>
    </div>
  );
}
