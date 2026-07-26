import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { grpLabel } from "../../lib/positions.js";
import { fmtShort, todayISO } from "../../lib/metrics.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { ClipboardList, Plus, CheckCircle, Trash2, Calendar } from "../../lib/icons.jsx";
import { useTeamTasks, useTeamTaskCompletions, createTask, createTasksRecurring, deleteTask, confirmTask, refuseTask } from "../../data/tasks.js";
import { buildAssigned, resolveAssignedIds } from "../../data/sessions.js";
import { getClubId } from "../../data/catalog.js";
import RecipientSelect from "../shared/RecipientSelect.jsx";
import RecurrenceSelector from "../shared/RecurrenceSelector.jsx";
import { useReadOnly } from "../../lib/readonly.js";

const accent = C.coral;
// Libellé du destinataire (Tag). Gère le mode COMBINÉ `mix` : lignes + « n joueurs ».
const modeLabel = (a, t) => {
  if (a?.mode === "group") return t("staff.tasks.modeGroup", { group: grpLabel(a.group) });
  if (a?.mode === "players") return t("staff.tasks.modePlayers", { count: (a.ids || []).length });
  if (a?.mode === "mix") {
    const parts = (a.groups || []).map(grpLabel);
    if ((a.ids || []).length) parts.push(t("staff.tasks.modePlayers", { count: a.ids.length }));
    return parts.join(" + ") || t("staff.tasks.modeAll");
  }
  return t("staff.tasks.modeAll");
};

/* Onglet « Tâches » (staff/owner) : créer des tâches + suivre la validation en
   2 temps (joueur « Fait » → coach « Valider »/« Refuser »). */
export default function Taches({ teamId, players = [], openNew = false }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const { tasks } = useTeamTasks(teamId, players);
  const { byTask } = useTeamTaskCompletions(teamId);
  const [creating, setCreating] = useState(!readOnly && !!openNew); // FAB « + Tâche » → formulaire ouvert d'emblée

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("staff.tasks.title", { count: tasks.length })}</div>
        {!readOnly && (
          <button onClick={() => setCreating((v) => !v)} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> {t("staff.tasks.newTask")}
          </button>
        )}
      </div>

      {!readOnly && creating && <TaskForm teamId={teamId} players={players} onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {tasks.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6 })}>
          {t("staff.tasks.empty")}
        </div>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} players={players} completions={byTask[task.id] || {}} teamId={teamId} />)
      )}
    </section>
  );
}

function TaskForm({ teamId, players, onDone, onCancel }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ titre: "", description: "", lieu: "" });
  const [rec, setRec] = useState({ all: true, groups: [], ids: [] });
  const [recur, setRecur] = useState(() => ({ mode: "once", date: "", time: "", weekdays: [], times: {}, start: todayISO(), end: "", exclusions: [] }));
  const [clubId, setClubId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", marginBottom: 8 };
  useEffect(() => { let a = true; getClubId(teamId).then((id) => { if (a) setClubId(id); }); return () => { a = false; }; }, [teamId]);

  const recipientCount = resolveAssignedIds(buildAssigned(rec), players).length;
  const payload = () => ({ titre: f.titre.trim(), description: f.description?.trim() || null, lieu: f.lieu?.trim() || null });

  const save = async () => {
    if (!f.titre.trim()) return setErr(t("staff.tasks.errTitle"));
    const assigned = buildAssigned(rec);
    setBusy(true); setErr("");
    try {
      if (recur.mode === "recurring") {
        const r = await createTasksRecurring(teamId, clubId, { value: recur, assigned, payload: payload() });
        if (!r.count) throw new Error("no_occurrences");
      } else {
        await createTask(teamId, { ...payload(), echeance: recur.date || null, assigned });
      }
      onDone();
    } catch (e) {
      setErr(e.message === "no_occurrences" ? t("recurrence.errNoOcc") : t("staff.tasks.errSave", { err: e.message || t("staff.tasks.errSaveRetry") }));
      setBusy(false);
    }
  };

  return (
    <div style={sc({ padding: 14, marginBottom: 12 })}>
      <input value={f.titre} onChange={(e) => { setF((p) => ({ ...p, titre: e.target.value })); setErr(""); }} placeholder={t("staff.tasks.phTitle")} maxLength={80} style={inp} />
      <textarea value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} placeholder={t("staff.tasks.phDesc")} style={{ ...inp, height: 48, resize: "none" }} />
      <input value={f.lieu} onChange={(e) => setF((p) => ({ ...p, lieu: e.target.value }))} placeholder={t("staff.tasks.phPlace")} style={inp} />

      <div style={{ marginBottom: 8 }}>
        <RecurrenceSelector value={recur} onChange={(nv) => { setRecur(nv); setErr(""); }} recipientCount={recipientCount} accent={accent} />
      </div>

      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 0.5, margin: "2px 0 6px" }}>{t("staff.tasks.recipients")}</div>
      <div style={{ marginBottom: 8 }}><RecipientSelect players={players} value={rec} onChange={setRec} accent={accent} /></div>

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ flex: 1, background: accent, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : recur.mode === "recurring" ? t("recurrence.saveRecurring") : t("staff.tasks.createTask")}</button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "10px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

function TaskCard({ task, players, completions, teamId }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const assignedPlayers = players.filter((p) => task.assignedIds.includes(p.id));
  const statutOf = (pid) => completions[pid]?.statut || "a_faire";
  const nbDone = assignedPlayers.filter((p) => statutOf(p.id) !== "a_faire").length;
  const nbToConfirm = assignedPlayers.filter((p) => statutOf(p.id) === "validee_joueur").length;

  const act = (k, fn) => { setBusy(k); fn().catch((e) => console.error("[task]", e.message)).finally(() => setBusy(null)); };

  return (
    <div style={sc({ marginBottom: 10, padding: 14 })}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{task.titre}</div>
          {task.description && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginTop: 2, lineHeight: 1.4 }}>{task.description}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {task.lieu && <Tag c={C.teal}>📍 {task.lieu}</Tag>}
            {task.echeance && <Tag c={C.amb}><Calendar size={10} /> {fmtShort(task.echeance)}</Tag>}
            {task.seriesId && <Tag c={C.teal}>{task.customized ? t("recurrence.tagCustom") : t("recurrence.tagSeries")}</Tag>}
            <Tag c={C.viol}>{modeLabel(task.assigned, t)}</Tag>
          </div>
        </div>
        {readOnly ? null : !confirmDel ? (
          <button onClick={() => setConfirmDel(true)} title={t("staff.tasks.deleteTitle")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => act("del", () => deleteTask(task.id))} disabled={busy === "del"} style={{ background: C.coral, border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{t("staff.tasks.del")}</button>
            <button onClick={() => setConfirmDel(false)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "4px 8px", color: "rgba(255,255,255,0.7)", fontSize: 10, cursor: "pointer" }}>×</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.55)" }}>{t("staff.tasks.validations", { done: nbDone, total: assignedPlayers.length })}</span>
        {nbToConfirm > 0 && <Tag c={C.amb}>{t("staff.tasks.toConfirm", { count: nbToConfirm })}</Tag>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {assignedPlayers.map((p) => {
          const st = statutOf(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{displayName(p)}</span>
              {st === "a_faire" && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{t("staff.tasks.todo")}</span>}
              {st === "confirmee" && <Tag c={C.green}>{t("staff.tasks.confirmed")}</Tag>}
              {st === "validee_joueur" && (
                <>
                  <Tag c={C.amb}>{t("staff.tasks.done")}{readOnly ? "" : t("staff.tasks.toValidateSuffix")}</Tag>
                  {!readOnly && <button onClick={() => act(`c${p.id}`, () => confirmTask(task.id, p.id, teamId))} disabled={busy === `c${p.id}`} style={{ background: C.green, border: "none", borderRadius: 7, padding: "4px 9px", color: "#fff", fontSize: 10.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> {t("staff.tasks.validate")}</button>}
                  {!readOnly && <button onClick={() => act(`r${p.id}`, () => refuseTask(task.id, p.id))} disabled={busy === `r${p.id}`} title={t("staff.tasks.refuseTitle")} style={{ background: "rgba(232,85,59,0.14)", border: `1px solid ${C.coral}44`, borderRadius: 7, padding: "4px 8px", color: C.coral, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{t("staff.tasks.refuse")}</button>}
                </>
              )}
            </div>
          );
        })}
        {assignedPlayers.length === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("staff.tasks.noRecipient")}</div>}
      </div>
    </div>
  );
}
