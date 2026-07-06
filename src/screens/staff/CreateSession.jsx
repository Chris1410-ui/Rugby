import { useState } from "react";
import { C, CODES } from "../../lib/tokens.js";
import { todayISO } from "../../lib/metrics.js";
import { grpLabel } from "../../lib/positions.js";
import { X, Plus } from "../../lib/icons.jsx";
import { createSession } from "../../data/sessions.js";

const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };
const lbl = { fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 5, fontWeight: 700 };

const blankExo = () => ({ name: "", sets: 3, reps: "8", charge: "", rest: 90 });

/* Création d'une séance par le staff (précurseur minimal des programmes, étape 7).
   Permet de tester le flux de logging joueur end-to-end. */
export default function CreateSession({ teamId, roster, onClose, onCreated }) {
  const [date, setDate] = useState(todayISO());
  const [code, setCode] = useState("RS");
  const [titre, setTitre] = useState("");
  const [dur, setDur] = useState(60);
  const [mode, setMode] = useState("all");
  const [group, setGroup] = useState("avants");
  const [exos, setExos] = useState([blankExo()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const groups = [...new Set(roster.map((p) => p.grp).filter(Boolean))];
  const setExo = (i, patch) => setExos((v) => v.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const save = async () => {
    const valid = exos.filter((e) => e.name.trim());
    if (!titre.trim()) return setErr("Donne un titre à la séance.");
    if (!valid.length) return setErr("Ajoute au moins un exercice.");
    setBusy(true); setErr("");
    const assigned = mode === "all" ? { mode: "all" } : mode === "group" ? { mode: "group", group } : { mode: "all" };
    try {
      await createSession(teamId, { date, code, titre, durationMin: Number(dur) || 60, exercises: valid, assigned });
      onCreated && onCreated();
      onClose();
    } catch (e) {
      setErr(e.message || "Échec de la création.");
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.panel, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Nouvelle séance</div>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><div style={lbl}>DATE</div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} /></div>
          <div><div style={lbl}>DURÉE (min)</div><input type="number" value={dur} onChange={(e) => setDur(e.target.value)} style={inp} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 10 }}>
          <div><div style={lbl}>CODE</div>
            <select value={code} onChange={(e) => setCode(e.target.value)} style={inp}>
              {Object.keys(CODES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><div style={lbl}>TITRE</div><input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Force corps entier" style={inp} /></div>
        </div>

        <div style={lbl}>DESTINATAIRES</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["all", "Toute l'équipe"], ["group", "Par ligne"]].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", background: mode === v ? C.coral : "rgba(255,255,255,0.07)", color: "#fff" }}>{l}</button>
          ))}
        </div>
        {mode === "group" && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} style={{ ...inp, marginBottom: 10 }}>
            {groups.map((g) => <option key={g} value={g}>{grpLabel(g)}</option>)}
          </select>
        )}

        <div style={lbl}>EXERCICES</div>
        {exos.map((e, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 42px 52px 56px 26px", gap: 5, marginBottom: 6, alignItems: "center" }}>
            <input value={e.name} onChange={(ev) => setExo(i, { name: ev.target.value })} placeholder="Exercice" style={{ ...inp, padding: "7px 9px" }} />
            <input value={e.sets} onChange={(ev) => setExo(i, { sets: ev.target.value })} placeholder="séries" inputMode="numeric" style={{ ...inp, padding: "7px 4px", textAlign: "center" }} title="séries" />
            <input value={e.reps} onChange={(ev) => setExo(i, { reps: ev.target.value })} placeholder="reps" style={{ ...inp, padding: "7px 4px", textAlign: "center" }} title="reps" />
            <input value={e.charge} onChange={(ev) => setExo(i, { charge: ev.target.value })} placeholder="@" style={{ ...inp, padding: "7px 4px", textAlign: "center" }} title="charge" />
            <button onClick={() => setExos((v) => v.filter((_, j) => j !== i))} disabled={exos.length === 1} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button onClick={() => setExos((v) => [...v, blankExo()])} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 11px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
          <Plus size={13} /> Ajouter un exercice
        </button>

        {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
        <button onClick={save} disabled={busy} style={{ width: "100%", background: C.coral, border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Création…" : "Envoyer la séance"}
        </button>
      </div>
    </div>
  );
}
