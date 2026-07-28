import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { searchExercises, equipmentLabel, targetLabel } from "../../data/exerciseLibrary.js";

/* Champ nom d'exercice avec autocomplétion sur le catalogue (~1300 + calisthénie)
   + les exos perso du club, classés par usage. Sélectionner une proposition lie
   la ligne à son `exercise_id` (via onPick) ; sinon le nom libre est conservé
   (création auto de l'exo perso à l'enregistrement). `style` reprend le style de
   la cellule hôte pour rester homogène. */
// Filtre d'autocomplétion approximatif par type de séance (champs dispo côté RPC :
// category=body_part, equipment, isCalisthenics — OU des critères présents). La
// feuille biblio (ExercisePickerSheet) applique le filtre EXACT côté serveur.
function matchesFilter(it, filter) {
  if (!filter) return true;
  if (filter.bodyPart && it.category === filter.bodyPart) return true;
  if (filter.equipment && it.equipment === filter.equipment) return true;
  if (filter.calisthenics && it.isCalisthenics) return true;
  return false;
}

export default function ExerciseAutocomplete({ value, onChange, onPick, placeholder, style, filter = null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const seq = useRef(0);

  // Recherche débouncée à la frappe.
  useEffect(() => {
    const q = (value || "").trim();
    if (!open || q.length < 2) { setItems([]); return; }
    const my = ++seq.current;
    const id = setTimeout(async () => {
      const res = await searchExercises(q, 10);
      if (my === seq.current) { setItems(filter ? res.filter((it) => matchesFilter(it, filter)) : res); setHi(0); }
    }, 160);
    return () => clearTimeout(id);
  }, [value, open, filter]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (it) => {
    onChange(it.name);
    onPick?.(it);            // lie exercise_id + ref éventuel
    setOpen(false);
    setItems([]);
  };

  const onKey = (e) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[hi]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={boxRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        value={value || ""}
        onChange={(e) => { onChange(e.target.value); onPick?.(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        style={{ ...style, width: "100%", boxSizing: "border-box" }}
      />
      {open && items.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, background: C.navy, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 3, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
          {items.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(it); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px", background: i === hi ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer", color: "#fff" }}
            >
              {it.thumbUrl
                ? <img src={it.thumbUrl} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "#000" }} />
                : <span style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{it.isCalisthenics ? "🤸" : "🏋️"}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[it.targetMuscle && targetLabel(t, it.targetMuscle), it.equipment && equipmentLabel(t, it.equipment)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {it.isCustom && <span style={{ fontSize: 8.5, fontWeight: 800, color: C.viol, background: `${C.viol}22`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>{t("exAuto.custom")}</span>}
              {it.usageCount > 0 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>×{it.usageCount}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
