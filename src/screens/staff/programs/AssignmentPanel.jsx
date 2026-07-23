import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { Plus, Trash2, Users } from "../../../lib/icons.jsx";
import { grpLabel } from "../../../lib/positions.js";
import { displayName } from "../../../lib/identity.js";
import { useTeamProgramAssignments, addAssignment, updateAssignment, deleteAssignment } from "../../../data/programAssignments.js";
import { isTargeted } from "../../../lib/program/assign.js";

const ACCENT = C.coral;
const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };
const iconBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: 8, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", flexShrink: 0 };
const miniBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 11px", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700 };

/* Panneau d'ASSIGNATION d'un protocole : cibler tout le club, un groupe
   (avants/arrières) ou un joueur, avec des cibles individualisées. Tant qu'il
   n'y a que des assignations « club » (ou aucune), le protocole reste visible
   par tout le club ; dès qu'un groupe/joueur est ciblé, il devient réservé. */
export default function AssignmentPanel({ teamId, programId, players = [] }) {
  const { t } = useTranslation();
  const { assignments } = useTeamProgramAssignments(teamId);
  const mine = assignments.filter((a) => a.programId === programId);
  const targeted = isTargeted(mine);

  const [scope, setScope] = useState("team");
  const [playerId, setPlayerId] = useState("");
  const [track, setTrack] = useState("");
  const [draft, setDraft] = useState([{ label: "", value: "" }]);
  const [busy, setBusy] = useState(false);

  const scopeOptions = [
    ["team", t("protocols.scopeTeam")],
    ["avants", t("protocols.scopeAvants")],
    ["arrieres", t("protocols.scopeArrieres")],
    ["player", t("protocols.scopePlayer")],
  ];

  const resetForm = () => { setScope("team"); setPlayerId(""); setTrack(""); setDraft([{ label: "", value: "" }]); };

  const add = async () => {
    const spec = scope === "team" ? { scope: "team" }
      : scope === "player" ? { scope: "player", playerId }
        : { scope: "group", groupKey: scope };
    if (scope === "player" && !playerId) return;
    setBusy(true);
    try { await addAssignment(teamId, programId, { ...spec, track, targets: draft }); resetForm(); }
    catch (e) { console.error("[assign add]", e.message); }
    setBusy(false);
  };

  const scopeLabel = (a) => {
    if (a.scope === "group") return grpLabel(a.groupKey);
    if (a.scope === "player") { const p = players.find((x) => x.id === a.playerId); return p ? displayName(p) : t("protocols.scopePlayer"); }
    return t("protocols.scopeTeam");
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Users size={16} color={ACCENT} />
        <div style={{ fontSize: 12.5, fontWeight: 800, flex: 1 }}>{t("protocols.assignTitle")}</div>
      </div>
      <div style={{ fontSize: 11, color: targeted ? C.amb : "rgba(255,255,255,0.55)", marginBottom: 12, lineHeight: 1.5 }}>
        {targeted ? t("protocols.assignTargeted") : t("protocols.assignTeamWide")}
      </div>

      {/* Assignations existantes */}
      {mine.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {mine.map((a) => <AssignmentCard key={a.id} a={a} label={scopeLabel(a)} t={t} />)}
        </div>
      )}

      {/* Nouvelle assignation */}
      <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {scopeOptions.map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)} style={{ background: scope === k ? `${ACCENT}22` : "rgba(255,255,255,0.05)", border: `1px solid ${scope === k ? ACCENT : C.border}`, borderRadius: 999, padding: "6px 12px", color: scope === k ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
        {scope === "player" && (
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
            <option value="">{t("protocols.pickPlayer")}</option>
            {players.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </select>
        )}
        <input style={{ ...inp, marginBottom: 8 }} value={track} onChange={(e) => setTrack(e.target.value)} placeholder={t("protocols.trackPh")} />
        <TargetEditor targets={draft} onChange={setDraft} t={t} />
        <button onClick={add} disabled={busy || (scope === "player" && !playerId)} style={{ marginTop: 10, width: "100%", background: ACCENT, border: "none", borderRadius: 10, padding: 10, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {t("protocols.addAssignment")}
        </button>
      </div>
    </div>
  );
}

// Carte d'une assignation existante : cibles éditables (persistées au blur) + suppression.
function AssignmentCard({ a, label, t }) {
  const [track, setTrack] = useState(a.track || "");
  const [targets, setTargets] = useState(a.targets?.length ? a.targets : [{ label: "", value: "" }]);

  const persist = (nextTrack, nextTargets) => {
    updateAssignment(a.id, { track: nextTrack, targets: nextTargets }).catch((e) => console.error("[assign update]", e.message));
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 11, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 7, padding: "3px 9px" }}>{label}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => deleteAssignment(a.id).catch((e) => console.error(e.message))} title={t("protocols.removeAssignment")} style={iconBtn}><Trash2 size={14} /></button>
      </div>
      <input style={{ ...inp, marginBottom: 8 }} value={track} onChange={(e) => setTrack(e.target.value)} onBlur={() => persist(track, targets)} placeholder={t("protocols.trackPh")} />
      <TargetEditor targets={targets} onChange={setTargets} onCommit={(next) => persist(track, next)} t={t} />
    </div>
  );
}

// Éditeur d'une liste de cibles [{label,value}]. onCommit (optionnel) persiste.
function TargetEditor({ targets, onChange, onCommit, t }) {
  const set = (i, patch) => { const next = targets.map((x, j) => (j === i ? { ...x, ...patch } : x)); onChange(next); };
  const commit = () => onCommit?.(targets);
  const add = () => { const next = [...targets, { label: "", value: "" }]; onChange(next); };
  const del = (i) => { const next = targets.filter((_, j) => j !== i); onChange(next.length ? next : [{ label: "", value: "" }]); onCommit?.(next); };
  return (
    <div>
      {targets.map((tg, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input style={{ ...inp, flex: 1 }} value={tg.label} onChange={(e) => set(i, { label: e.target.value })} onBlur={commit} placeholder={t("protocols.targetLabelPh")} />
          <input style={{ ...inp, flex: 1 }} value={tg.value} onChange={(e) => set(i, { value: e.target.value })} onBlur={commit} placeholder={t("protocols.targetValuePh")} />
          <button onClick={() => del(i)} title={t("protocols.remove")} style={iconBtn}><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={add} style={miniBtn}><Plus size={12} /> {t("protocols.addTarget")}</button>
    </div>
  );
}
