import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { SLEEP_OPTIONS, sleepLabel } from "../../../lib/metrics.js";

/* Briques VISUELLES partagées des formulaires de bilan (extraites INCHANGÉES de
   l'ancien Bilan.jsx). Constantes/helpers sans JSX dans parts.js. */

// Bandeau d'état d'un bloc (à remplir / complété ✓ à HHhMM).
export function BlockState({ done, at }) {
  const { t } = useTranslation();
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: done ? `${C.green}22` : "rgba(255,255,255,0.06)", border: `1px solid ${done ? C.green + "66" : C.border}`, color: done ? C.green : "rgba(255,255,255,0.6)" }}>
      {done ? (at ? t("player.bilan.blockDoneAt", { at }) : t("player.bilan.blockDone")) : t("player.bilan.blockTodo")}
    </span>
  );
}

export function Slider({ label, value, color, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}/10</span>
      </div>
      <input type="range" min="1" max="10" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: color, height: 4 }} />
    </div>
  );
}

/* Sélecteur d'heures de sommeil par tranches de 30 min (cibles ≥44px). */
export function SleepPicker({ value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {SLEEP_OPTIONS.map((h) => {
        const on = Number(value) === h;
        return (
          <button key={h} type="button" onClick={() => !disabled && onChange(h)} disabled={disabled} aria-pressed={on}
            style={{ flex: "1 0 auto", minWidth: 58, minHeight: 44, padding: "0 12px", borderRadius: 10, cursor: disabled ? "default" : "pointer", background: on ? C.viol : "rgba(255,255,255,0.06)", border: `1.5px solid ${on ? C.viol : C.border}`, color: on ? "#fff" : "rgba(255,255,255,0.75)", fontSize: 13.5, fontWeight: on ? 800 : 600, opacity: disabled ? 0.55 : 1 }}>
            {sleepLabel(h)}
          </button>
        );
      })}
    </div>
  );
}
