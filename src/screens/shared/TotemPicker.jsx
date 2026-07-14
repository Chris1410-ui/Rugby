import { C } from "../../lib/tokens.js";
import { TOTEMS, randomTotem } from "../../lib/totems.js";

/* Sélecteur de totem (pseudo joueur). Champ libre + suggestions cliquables +
   tirage aléatoire. `value`/`onChange` contrôlés par le parent. */
export default function TotemPicker({ value, onChange, accent = C.green }) {
  const set = (v) => onChange(v);
  const input = {
    flex: 1, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none",
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="Ton totem (ex. Minotaure)"
          maxLength={24}
          style={input}
        />
        <button type="button" onClick={() => set(randomTotem())} title="Totem aléatoire"
          style={{ flexShrink: 0, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 10, padding: "0 14px", color: accent, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
          🎲
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {TOTEMS.slice(0, 12).map((t) => {
          const on = value.trim().toLowerCase() === t.toLowerCase();
          return (
            <button key={t} type="button" onClick={() => set(t)}
              style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}33` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: on ? 800 : 600, cursor: "pointer" }}>
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
