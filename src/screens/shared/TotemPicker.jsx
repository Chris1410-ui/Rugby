import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { TOTEMS, randomFreeTotem, freeTotem, isTotemTaken } from "../../lib/totems.js";

/* Sélecteur de totem (pseudo joueur). Champ libre + suggestions cliquables +
   tirage aléatoire. `value`/`onChange` contrôlés par le parent. `taken` = liste
   des totems DÉJÀ pris dans le club (hors joueur courant) : le tirage aléatoire
   et les suggestions les excluent, et une collision est signalée avec une
   alternative libre en un clic. */
export default function TotemPicker({ value, onChange, accent = C.green, taken = [] }) {
  const { t } = useTranslation();
  const set = (v) => onChange(v);
  const usedLc = new Set([...taken].map((x) => String(x).trim().toLowerCase()).filter(Boolean));
  const collision = isTotemTaken(taken, value);
  const suggestion = collision ? freeTotem(taken, value) : "";
  const input = {
    flex: 1, background: "rgba(255,255,255,0.08)", border: `1px solid ${collision ? C.coral : C.border}`,
    borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none",
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={t("shared.totem.placeholder")}
          maxLength={24}
          style={input}
        />
        <button type="button" onClick={() => set(randomFreeTotem(taken))} title={t("shared.totem.randomTitle")}
          style={{ flexShrink: 0, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 10, padding: "0 14px", color: accent, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
          🎲
        </button>
      </div>
      {/* Collision : refus visuel + alternative libre proposée en un clic. */}
      {collision && (
        <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{t("shared.totem.taken")}</span>
          <button type="button" onClick={() => set(suggestion)}
            style={{ padding: "3px 9px", borderRadius: 20, border: `1px solid ${accent}66`, background: `${accent}22`, color: accent, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            {t("shared.totem.useAlt", { totem: suggestion })}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {TOTEMS.slice(0, 12).map((tt) => {
          const isTaken = usedLc.has(tt.toLowerCase());
          const on = value.trim().toLowerCase() === tt.toLowerCase();
          return (
            <button key={tt} type="button" disabled={isTaken} onClick={() => !isTaken && set(tt)}
              title={isTaken ? t("shared.totem.taken") : undefined}
              style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}33` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11, fontWeight: on ? 800 : 600, cursor: isTaken ? "not-allowed" : "pointer", opacity: isTaken ? 0.35 : 1, textDecoration: isTaken ? "line-through" : "none" }}>
              {tt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
