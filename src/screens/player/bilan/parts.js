import { C } from "../../../lib/tokens.js";
import { localeTag } from "../../../i18n/locale.js";

/* Constantes & helpers partagés des formulaires de bilan (sans JSX). Composants
   visuels dans parts.jsx. Extraits INCHANGÉS de l'ancien Bilan.jsx. */

export const WELL_KEYS = [
  ["sleep", C.viol], ["energy", C.green], ["fatigue", C.coral],
  ["soreness", C.amb], ["mood", C.blue], ["stress", C.teal],
];

export const morningDefaults = (me) => ({
  wb: { sleep: 7, energy: 6, fatigue: 4, soreness: 4, mood: 7, stress: 4 },
  sleepH: me?.sleep ? Number(me.sleep) : 7.5,
  hydra: 2.0, fc: null, hrv: null, poids: null, activities: [],
});
export const eveningDefaults = () => ({ quality: 6, intensity: 6, difficulty: 5, fatigue: 5, moral: 7, motivation: 7, ressentiMatch: "", remarques: "" });

// Réhydrate l'état matin depuis le bilan persisté (préserve toutes les clés).
export const seedMorning = (me, matin) => {
  const base = morningDefaults(me);
  if (!matin) return base;
  return {
    wb: { ...base.wb, ...matin.wb },
    sleepH: matin.sleepH ?? base.sleepH,
    hydra: matin.hydra ?? 2.0,
    fc: matin.fc ?? null, hrv: matin.hrv ?? null, poids: matin.poids ?? null,
    activities: matin.activities ?? [],
  };
};

export const hhmm = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(localeTag(), { hour: "2-digit", minute: "2-digit" }).replace(":", "h"); }
  catch { return ""; }
};

export const numInp = (c) => ({ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 8px", color: c, fontSize: 15, fontWeight: 700, outline: "none" });
export const txtInp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", minHeight: 60, boxSizing: "border-box" };

// Style commun du bouton d'enregistrement (matin/soir/activités).
export const saveBtnProps = ({ preview, saved, busy, onClick, colorOn }) => ({
  onClick, disabled: preview || saved || busy,
  style: { width: "100%", background: preview ? "rgba(255,255,255,0.06)" : saved ? "rgba(44,140,90,0.2)" : colorOn, border: preview ? `1px solid ${C.border}` : saved ? `1px solid ${C.green}66` : "none", borderRadius: 12, padding: 14, color: preview ? "rgba(255,255,255,0.6)" : saved ? C.green : "#fff", fontWeight: 700, fontSize: 14, cursor: preview || saved ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 },
});
