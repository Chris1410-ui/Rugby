import { supabase } from "../lib/supabase.js";
import { isoDate, parseISO } from "../lib/metrics.js";
import { blockKind } from "../lib/sessionType.js";

/* Séances libres (autonomes) créées par le joueur — cf. migrations 0054/0110/0111.
   Le joueur n'écrit pas sur `sessions` directement : passage par des fonctions
   SECURITY DEFINER. La séance créée est datée du jour, assignée au joueur seul,
   et se loggue ensuite avec le moteur habituel (SessionPlayCard → session_logs).

   Depuis PR2, un item d'`exercises` porte un `kind` (défaut 'strength', cf.
   sessionType.js) : chaque kind a sa forme propre. Un item sans `kind` = force
   (rétro-compat total : anciennes séances / import PDF inchangés). */

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

// Normaliseurs PURS par kind. Chacun renvoie l'objet bloc stocké dans
// sessions.exercises, ou null si le bloc est vide (→ filtré).
const NORMALIZERS = {
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

// Normalise le panier (hétérogène) → items stockés. Dispatch par kind ; un item
// sans kind = force. Les blocs vides sont écartés. PUR & testable.
export function normalizeFreeExercises(items) {
  return (items || [])
    .map((e) => (e ? (NORMALIZERS[blockKind(e)] || NORMALIZERS.strength)(e) : null))
    .filter(Boolean);
}

export async function createFreeSession({ title, code, type, nature, durationMin, exercises }) {
  const rows = normalizeFreeExercises(exercises);
  if (rows.length === 0) throw new Error("NO_EXERCISE");
  const { data, error } = await supabase.rpc("create_free_session", {
    p_title: (title || "").trim() || null,
    p_code: code || "RS",
    p_duration: Number(durationMin) > 0 ? Number(durationMin) : 60,
    p_exercises: rows,
    p_type: type || "strength",
    p_nature: nature || null,
  });
  if (error) throw error;
  return data; // id de la séance créée
}

export async function deleteFreeSession(sessionId) {
  const { error } = await supabase.rpc("delete_free_session", { p_session: sessionId });
  if (error) throw error;
}

/* Import PDF (joueur) : développe les séances validées (weekday) sur `weeks`
   semaines à partir de `startDate` → lignes DATÉES { date, code, nature, titre,
   exercises }. Fonction PURE (testable). Première occurrence = premier jour ≥
   startDate correspondant au weekday, puis répétition hebdomadaire. */
export function expandProgramToRows(sessions, startISO, weeks) {
  const rows = [];
  const w = Math.max(1, Math.min(12, Number(weeks) || 4));
  const base = parseISO(startISO);
  if (!base || isNaN(base.getTime())) return rows;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  for (const s of sessions || []) {
    const exos = normalizeFreeExercises(s.exercises);
    if (!exos.length) continue;
    const wd = Number(s.weekday) || 0;
    const delta = (wd - start.getDay() + 7) % 7;
    const first = new Date(start); first.setDate(start.getDate() + delta);
    for (let k = 0; k < w; k++) {
      const d = new Date(first); d.setDate(first.getDate() + 7 * k);
      rows.push({ date: isoDate(d), code: s.code || "RS", nature: s.nature || "", titre: s.titre || "Séance importée", exercises: exos });
    }
  }
  return rows;
}

// Matérialise le programme importé pour le joueur connecté (séances datées).
export async function importProgramForSelf(sessions, { startDate, weeks } = {}) {
  const rows = expandProgramToRows(sessions, startDate, weeks);
  if (!rows.length) throw new Error("NO_ROWS");
  const { data, error } = await supabase.rpc("import_program_sessions", { p_rows: rows });
  if (error) throw error;
  return data; // nombre de séances créées
}

/* Import PDF par le STAFF sur la fiche d'un joueur : matérialise les séances
   datées ASSIGNÉES à ce joueur. Le staff a le droit d'écrire sur `sessions`
   (RLS can_write) → insertion directe (pas de RPC joueur). origin='import'. */
export async function importProgramForPlayer(playerId, teamId, sessions, { startDate, weeks } = {}) {
  if (!playerId || !teamId) throw new Error("NO_TARGET");
  const rows = expandProgramToRows(sessions, startDate, weeks);
  if (!rows.length) throw new Error("NO_ROWS");
  const payload = rows.map((r) => ({
    team_id: teamId,
    date: r.date,
    code: r.code || "RS",
    nature: r.nature || null,
    titre: r.titre || "Séance importée",
    duration_min: 60,
    exercises: r.exercises,
    assigned: { mode: "players", ids: [playerId] },
    origin: "import",
  }));
  const { error } = await supabase.from("sessions").insert(payload);
  if (error) throw error;
  return payload.length; // nombre de séances créées
}
