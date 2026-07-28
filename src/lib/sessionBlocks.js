import { blockKind } from "./sessionType.js";

/* Normaliseurs PURS des blocs de séance (items de `sessions.exercises`), par
   kind. Extrait de data/freeSessions.js (PR5) pour être réutilisable par la
   MATÉRIALISATION des protocoles (lib pure, sans supabase) autant que par la
   séance libre du joueur. Un item sans `kind` = force (rétro-compat total). */

const uid = () => (globalThis.crypto?.randomUUID?.() || `e${Math.random().toString(36).slice(2, 10)}`);

// Helpers de nettoyage (jamais de NaN/valeur fausse : on renvoie null si absent).
const str = (v) => (v != null && String(v).trim() ? String(v).trim() : "");
const posInt = (v, dflt = null) => (Number(v) > 0 ? Math.round(Number(v)) : dflt);
const posNum = (v) => (Number(v) > 0 ? Number(v) : null);
const clampPct = (v) => (Number(v) > 0 ? Math.min(100, Math.round(Number(v))) : null);
const effortSpec = (o) => {
  const d = posInt(o?.durationSec), m = posNum(o?.distanceM);
  if (d != null) return { durationSec: d };
  if (m != null) return { distanceM: m };
  return null;
};

// Chaque normaliseur renvoie l'objet bloc stocké, ou null si le bloc est vide.
export const NORMALIZERS = {
  strength: (e) => (str(e.name) ? {
    id: e.id || uid(), kind: "strength", name: str(e.name),
    sets: posInt(e.sets, 3), reps: str(e.reps) || "8", charge: str(e.charge),
    rest: posInt(e.rest, 90), ref: e.ref || null,
  } : null),

  // Poids de corps : pas de charge ; un lest OPTIONNEL est rangé dans `charge`
  // (kg) pour rester loggable par la carte actuelle (poids ajouté = colonne poids).
  bodyweight: (e) => (str(e.name) ? {
    id: e.id || uid(), kind: "bodyweight", name: str(e.name),
    sets: posInt(e.sets, 3), reps: str(e.reps) || "8",
    charge: posNum(e.lest ?? e.addedLoadKg) != null ? String(posNum(e.lest ?? e.addedLoadKg)) : "",
    rest: posInt(e.rest, 90), ref: e.ref || null,
  } : null),

  // Skill / technique : reps OU tenue (measure), sans charge.
  skill: (e) => (str(e.name) ? {
    id: e.id || uid(), kind: "skill", name: str(e.name),
    sets: posInt(e.sets, 3),
    measure: e.measure === "temps" ? "temps" : "reps",
    reps: e.measure === "temps" ? null : (str(e.reps) || "8"),
    holdSec: e.measure === "temps" ? posInt(e.holdSec, 20) : null,
    rest: posInt(e.rest, 90), ref: e.ref || null,
  } : null),

  // Cardio continu : distance et/ou durée, %VMA optionnel.
  cardio_continuous: (e) => {
    const distanceM = posNum(e.distanceM), durationSec = posInt(e.durationSec);
    if (distanceM == null && durationSec == null) return null;
    return { id: e.id || uid(), kind: "cardio_continuous", name: str(e.name) || null, distanceM, durationSec, pctVMA: clampPct(e.pctVMA), hrTarget: posInt(e.hrTarget), note: str(e.note) || null };
  },

  // Cardio intervalles : N × (effort) / (récup), %VMA optionnel. Variation par
  // répétition possible via repPlan (effort/récup/%VMA propres à chaque rép).
  cardio_interval: (e) => {
    const reps = posInt(e.reps), effort = effortSpec(e.effort), recovery = effortSpec(e.recovery);
    const repPlan = (Array.isArray(e.repPlan) ? e.repPlan : [])
      .map((rp) => { const ef = effortSpec(rp?.effort); return ef ? { effort: ef, recovery: effortSpec(rp?.recovery), pctVMA: clampPct(rp?.pctVMA) } : null; })
      .filter(Boolean);
    if (!reps || !effort) return null;
    return {
      id: e.id || uid(), kind: "cardio_interval", name: str(e.name) || null,
      reps, effort, recovery, pctVMA: clampPct(e.pctVMA), note: str(e.note) || null,
      ...(repPlan.length ? { repPlan } : {}),
    };
  },

  // Circuit / AMRAP / EMOM : durée totale + items du tour.
  cardio_circuit: (e) => {
    const totalDurationSec = posInt(e.totalDurationSec);
    const roundItems = (Array.isArray(e.roundItems) ? e.roundItems : [])
      .filter((it) => str(it?.name))
      .map((it) => ({ name: str(it.name), reps: posInt(it.reps), sec: posInt(it.sec) }));
    if (!totalDurationSec && roundItems.length === 0) return null;
    const mode = ["amrap", "emom", "circuit"].includes(e.mode) ? e.mode : "circuit";
    return { id: e.id || uid(), kind: "cardio_circuit", mode, totalDurationSec, roundItems, note: str(e.note) || null };
  },

  // Test / effort max : référence un test de la batterie (résultat saisi ailleurs).
  cardio_test: (e) => (str(e.testKey) ? {
    id: e.id || uid(), kind: "cardio_test", testKey: str(e.testKey), name: str(e.name) || null, note: str(e.note) || null,
  } : null),
};

// Normalise une liste (hétérogène) → items stockés. Dispatch par kind ; un item
// sans kind = force. Les blocs vides sont écartés. PUR & testable.
export function normalizeBlocks(items) {
  return (items || [])
    .map((e) => (e ? (NORMALIZERS[blockKind(e)] || NORMALIZERS.strength)(e) : null))
    .filter(Boolean);
}
