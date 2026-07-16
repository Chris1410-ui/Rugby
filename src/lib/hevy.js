/* Historique par exercice façon Hevy — porté du prototype.
   Perf précédente, records, 1RM estimé (Epley). Opère sur la map `logs`
   (logs[sessionId][playerId].perExercise[eid].sets) et la liste `sessions`. */

import { C } from "./tokens.js";

export const e1RM = (w, reps) => (w > 0 && reps > 0 ? Math.round(w * (1 + reps / 30)) : 0); // Epley
export const workingSets = (pe) => (pe?.sets || []).filter((s) => s.type !== "warmup" && s.done);
export const setVol = (pe) => workingSets(pe).reduce((a, s) => a + (+s.w || 0) * (+s.reps || 0), 0);
export const setTop = (pe) => workingSets(pe).reduce((m, s) => Math.max(m, +s.w || 0), 0);

// clé stable d'un exercice = son nom normalisé (les ids changent d'une séance à l'autre)
export const exKey = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);

export function exerciseHistory(logs, sessions, pid, exName, beforeDate) {
  const key = exKey(exName);
  const out = [];
  sessions
    .filter((s) => s.assignedIds?.includes(pid) && (!beforeDate || s.date < beforeDate))
    .forEach((s) => {
      const lg = logs?.[s.id]?.[pid];
      if (!lg || lg.status !== "done") return;
      (s.exercises || []).forEach((e) => {
        if (exKey(e.name) !== key) return;
        const pe = lg.perExercise?.[e.id];
        const ws = workingSets(pe);
        if (!ws.length) return;
        out.push({
          date: s.date,
          top: setTop(pe),
          vol: setVol(pe),
          reps: ws.reduce((a, x) => a + (+x.reps || 0), 0),
          best1rm: Math.max(...ws.map((x) => e1RM(+x.w, +x.reps))),
          sets: ws,
        });
      });
    });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const lastExercisePerf = (logs, sessions, pid, exName, beforeDate) => {
  const h = exerciseHistory(logs, sessions, pid, exName, beforeDate);
  return h.length ? h[h.length - 1] : null;
};

export function exerciseRecords(logs, sessions, pid, exName, beforeDate) {
  const h = exerciseHistory(logs, sessions, pid, exName, beforeDate);
  return {
    top: Math.max(0, ...h.map((x) => x.top)),
    vol: Math.max(0, ...h.map((x) => x.vol)),
    oneRM: Math.max(0, ...h.map((x) => x.best1rm)),
    n: h.length,
  };
}

export const SET_TYPES = {
  normal: { l: "N", c: "rgba(255,255,255,0.3)", name: "Normale" },
  warmup: { l: "É", c: C.amb, name: "Échauffement" },
  drop: { l: "D", c: C.viol, name: "Dégressive" },
  fail: { l: "E", c: C.coral, name: "Échec" },
};
export const nextSetType = (t) => ({ normal: "warmup", warmup: "drop", drop: "fail", fail: "normal" }[t || "normal"]);
export const parseSetsN = (v) => {
  const n = parseInt(v, 10);
  return isNaN(n) ? 3 : Math.max(1, Math.min(10, n));
};

// Charge prescrite « 120 », « 120 kg », « 120,5 » → nombre (null si non chiffrée)
export const parseChargeKg = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
};

/* Comparatif PRESCRIT (séance) vs RÉALISÉ (log). `ex` = exercice de la séance
   (sets/reps/charge prescrits), `pe` = perExercise[eid] du log (séries réalisées).
   Purement informatif — ne modifie aucune formule de charge (sRPE). Renvoie les
   nombres bruts + un booléen `diff` (écart à signaler) ; `hasRealized` distingue
   « rien fait encore » de « fait à l'identique ». */
export function prescribedVsRealized(ex, pe) {
  const prescSets = parseSetsN(ex?.sets);
  const prescCharge = parseChargeKg(ex?.charge);
  const ws = workingSets(pe);
  const doneSets = ws.length;
  const realTop = setTop(pe);
  const hasRealized = doneSets > 0 || realTop > 0;
  const setsDiff = hasRealized && doneSets !== prescSets;
  const chargeDiff = prescCharge != null && realTop > 0 && realTop !== prescCharge;
  return {
    prescSets, prescReps: ex?.reps ?? "", prescCharge,
    doneSets, realTop, hasRealized,
    setsDiff, chargeDiff,
    diff: hasRealized && (setsDiff || chargeDiff),
  };
}
