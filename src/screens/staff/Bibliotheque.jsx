import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { EXCATS, EXCATC } from "../../lib/exlib.js";
import { Plus, X, Search } from "../../lib/icons.jsx";
import { useExercises, addCustomExercise } from "../../data/exercises.js";

const accent = C.coral;

/* Bibliothèque d'exercices : catalogue global + perso d'équipe, avec cues. */
export default function Bibliotheque({ teamId }) {
  const { exercises } = useExercises(teamId);
  const [cat, setCat] = useState("Toutes");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState("");
  const [nCat, setNCat] = useState("Force");
  const [nCues, setNCues] = useState("");
  const [busy, setBusy] = useState(false);

  const list = exercises.filter((e) => (cat === "Toutes" || e.cat === cat) && (!q || e.name.toLowerCase().includes(q.toLowerCase())));

  const addCustom = async () => {
    if (!nName.trim()) return;
    setBusy(true);
    try {
      await addCustomExercise(teamId, { name: nName, cat: nCat, cues: nCues });
      setAdding(false); setNName(""); setNCues("");
    } catch (e) { console.error(e.message); }
    setBusy(false);
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none", marginBottom: 8 };

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un exercice…" style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px 10px 34px", color: "#fff", fontSize: 13, outline: "none" }} />
        </div>
        <button onClick={() => setAdding((a) => !a)} style={{ background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 9, padding: "0 14px", color: accent, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Créer
        </button>
      </div>

      {adding && (
        <div style={sc({ marginBottom: 12 })}>
          <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nom de l'exercice" autoFocus style={inp} />
          <select value={nCat} onChange={(e) => setNCat(e.target.value)} style={{ ...inp, fontWeight: 600 }}>
            {EXCATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea value={nCues} onChange={(e) => setNCues(e.target.value)} placeholder="Repères d'exécution (cues)" style={{ ...inp, resize: "none", height: 50 }} />
          <button onClick={addCustom} disabled={!nName.trim() || busy} style={{ width: "100%", background: nName.trim() ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: nName.trim() ? 1 : 0.5 }}>
            {busy ? "Ajout…" : "Ajouter à la bibliothèque"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {["Toutes", ...EXCATS].map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: cat === c ? (EXCATC[c] || accent) : "rgba(255,255,255,0.07)", color: "#fff" }}>{c}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {list.map((e) => (
          <div key={e.id} onClick={() => setSel(e)} style={sc({ padding: 12, cursor: "pointer", borderLeft: `3px solid ${EXCATC[e.cat] || accent}` })}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{e.name}{e.custom && <span style={{ fontSize: 8, color: accent, marginLeft: 5 }}>● perso</span>}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{e.q}</div>
          </div>
        ))}
      </div>
      {list.length === 0 && <div style={{ textAlign: "center", padding: "34px 18px", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Aucun exercice. Modifie ta recherche ou crée un exercice personnalisé.</div>}

      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px" }} onClick={() => setSel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, margin: "0 auto", background: C.panel, borderRadius: 18, padding: 22, maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div><div style={{ fontSize: 18, fontWeight: 800 }}>{sel.name}</div><div style={{ fontSize: 11, color: EXCATC[sel.cat] || accent, fontWeight: 700, marginTop: 2 }}>{sel.cat} · {sel.q}</div></div>
              <X size={20} color="rgba(255,255,255,0.5)" onClick={() => setSel(null)} style={{ cursor: "pointer" }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 6 }}>REPÈRES D'EXÉCUTION</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{sel.cues}</div>
          </div>
        </div>
      )}
    </section>
  );
}
