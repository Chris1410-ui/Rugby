import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { fmtShort } from "../../lib/metrics.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { ClipboardList, Plus, CheckCircle, Trash2, Calendar } from "../../lib/icons.jsx";
import { useTeamTasks, useTeamTaskCompletions, createTask, deleteTask, confirmTask, refuseTask } from "../../data/tasks.js";

const accent = C.coral;
const modeLabel = (a) => a?.mode === "group" ? `Ligne · ${grpLabel(a.group)}` : a?.mode === "players" ? `${(a.ids || []).length} joueur(s)` : "Toute l'équipe";

/* Onglet « Tâches » (staff/owner) : créer des tâches + suivre la validation en
   2 temps (joueur « Fait » → coach « Valider »/« Refuser »). */
export default function Taches({ teamId, players = [], openNew = false }) {
  const { tasks } = useTeamTasks(teamId, players);
  const { byTask } = useTeamTaskCompletions(teamId);
  const [creating, setCreating] = useState(!!openNew); // FAB « + Tâche » → formulaire ouvert d'emblée

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardList size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Tâches · {tasks.length}</div>
        <button onClick={() => setCreating((v) => !v)} style={{ background: accent, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Nouvelle tâche
        </button>
      </div>

      {creating && <TaskForm teamId={teamId} players={players} onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {tasks.length === 0 ? (
        <div style={sc({ textAlign: "center", padding: 28, color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6 })}>
          Aucune tâche. Crée-en une (ex. « Amener ses crampons », « RDV kiné »)  — le joueur la valide, tu confirmes, +2 points.
        </div>
      ) : (
        tasks.map((t) => <TaskCard key={t.id} task={t} players={players} completions={byTask[t.id] || {}} teamId={teamId} />)
      )}
    </section>
  );
}

function TaskForm({ teamId, players, onDone, onCancel }) {
  const [f, setF] = useState({ titre: "", description: "", lieu: "", echeance: "" });
  const [mode, setMode] = useState("all");
  const [group, setGroup] = useState("");
  const [ids, setIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const grps = [...new Set(players.map((p) => p.grp).filter(Boolean))];
  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", marginBottom: 8 };

  const toggleId = (id) => setIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);

  const save = async () => {
    if (!f.titre.trim()) return setErr("Donne un titre à la tâche.");
    const assigned = mode === "group" ? { mode: "group", group: group || grps[0] } : mode === "players" ? { mode: "players", ids } : { mode: "all" };
    if (mode === "players" && ids.length === 0) return setErr("Choisis au moins un joueur.");
    setBusy(true); setErr("");
    try { await createTask(teamId, { ...f, echeance: f.echeance || null, assigned }); onDone(); }
    catch (e) { setErr("Échec : " + (e.message || "réessaie.")); setBusy(false); }
  };

  return (
    <div style={sc({ padding: 14, marginBottom: 12 })}>
      <input value={f.titre} onChange={(e) => { setF((p) => ({ ...p, titre: e.target.value })); setErr(""); }} placeholder="Titre (ex. Amener ses crampons)" maxLength={80} style={inp} />
      <textarea value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} placeholder="Description (optionnel)" style={{ ...inp, height: 48, resize: "none" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={f.lieu} onChange={(e) => setF((p) => ({ ...p, lieu: e.target.value }))} placeholder="Lieu (optionnel)" style={{ ...inp, flex: 1 }} />
        <input type="date" value={f.echeance} onChange={(e) => setF((p) => ({ ...p, echeance: e.target.value }))} title="Échéance (optionnelle)" style={{ ...inp, flex: "0 0 150px" }} />
      </div>

      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 0.5, margin: "2px 0 6px" }}>DESTINATAIRES</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {[["all", "Toute l'équipe"], ["group", "Une ligne"], ["players", "Joueurs choisis"]].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} style={{ padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: mode === v ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>{l}</button>
        ))}
      </div>
      {mode === "group" && (
        <select value={group || grps[0] || ""} onChange={(e) => setGroup(e.target.value)} style={inp}>
          {grps.map((g) => <option key={g} value={g}>{grpLabel(g)}</option>)}
        </select>
      )}
      {mode === "players" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto", marginBottom: 8 }}>
          {players.map((p) => (
            <button key={p.id} onClick={() => toggleId(p.id)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${ids.includes(p.id) ? accent : C.border}`, background: ids.includes(p.id) ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{p.name}</button>
          ))}
        </div>
      )}

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ flex: 1, background: accent, border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Créer la tâche"}</button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "10px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Annuler</button>
      </div>
    </div>
  );
}

function TaskCard({ task, players, completions, teamId }) {
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
            <Tag c={C.viol}>{modeLabel(task.assigned)}</Tag>
          </div>
        </div>
        {!confirmDel ? (
          <button onClick={() => setConfirmDel(true)} title="Supprimer" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => act("del", () => deleteTask(task.id))} disabled={busy === "del"} style={{ background: C.coral, border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Suppr.</button>
            <button onClick={() => setConfirmDel(false)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "4px 8px", color: "rgba(255,255,255,0.7)", fontSize: 10, cursor: "pointer" }}>×</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.55)" }}>VALIDATIONS · {nbDone}/{assignedPlayers.length}</span>
        {nbToConfirm > 0 && <Tag c={C.amb}>{nbToConfirm} à confirmer</Tag>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {assignedPlayers.map((p) => {
          const st = statutOf(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
              {st === "a_faire" && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>à faire</span>}
              {st === "confirmee" && <Tag c={C.green}>✓ Confirmée</Tag>}
              {st === "validee_joueur" && (
                <>
                  <Tag c={C.amb}>Fait — à valider</Tag>
                  <button onClick={() => act(`c${p.id}`, () => confirmTask(task.id, p.id, teamId))} disabled={busy === `c${p.id}`} style={{ background: C.green, border: "none", borderRadius: 7, padding: "4px 9px", color: "#fff", fontSize: 10.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> Valider</button>
                  <button onClick={() => act(`r${p.id}`, () => refuseTask(task.id, p.id))} disabled={busy === `r${p.id}`} title="Refuser (retire les points)" style={{ background: "rgba(232,85,59,0.14)", border: `1px solid ${C.coral}44`, borderRadius: 7, padding: "4px 8px", color: C.coral, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>Refuser</button>
                </>
              )}
            </div>
          );
        })}
        {assignedPlayers.length === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Aucun destinataire dans l'effectif.</div>}
      </div>
    </div>
  );
}
