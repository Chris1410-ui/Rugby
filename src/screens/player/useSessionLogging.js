import { useEffect, useMemo, useRef, useState } from "react";
import { todayISO } from "../../lib/metrics.js";
import {
  e1RM, initSetLikeSets, fillEmptySetsFromOneRM,
  exerciseRecords,
} from "../../lib/hevy.js";
import { saveLog } from "../../data/logs.js";
import { usePlayer1RM } from "../../data/player1rm.js";
import { summarize1RM, computeLoadKg, movementIdentity } from "../../lib/oneRM.js";
import { exerciseInputModel } from "../../lib/sessionType.js";
import { effectiveNature } from "../../lib/nature.js";
import { parsePrescribedMetrics } from "../../lib/effort.js";
import { usePreview } from "../../lib/preview.js";
import { TEST_METRICS } from "../../data/tests.js";

// Libellé + unité d'un test de la batterie (pour les blocs cardio_test).
const testMeta = (key) => TEST_METRICS.find((m) => m.key === key) || null;

/* ═══════════════════════════════════════════════════════════════════════════
   useSessionLogging — état + règles de la SAISIE set-par-set d'une séance.
   ───────────────────────────────────────────────────────────────────────────
   SOURCE DE VÉRITÉ UNIQUE partagée par le lecteur en carte (SessionPlayCard) et
   la vue plein écran (SessionLive) : garantit un comportement IDENTIQUE des
   invariants critiques —
   • pré-remplissage 1RM / reps (initSetLikeSets, jamais d'écrasement d'une
     valeur saisie) ;
   • ISOLATION par (exercice, série) : état indexé par id d'exercice STABLE
     (repli déterministe « x{i} »), séries indexées par position ;
   • SOUVERAINETÉ : la saisie du joueur (`saved`) prime, la resync depuis la
     base ne l'écrase jamais tant qu'une saisie non enregistrée est en cours.
   Extrait TEL QUEL de SessionPlayCard (logique inchangée). Le rendu (peaux)
   vit dans les composants ; ici, uniquement l'état et les actions.

   `active` = la surface de saisie est-elle visible (carte dépliée / plein écran
   ouvert) → pilote le chrono optionnel.
   ═══════════════════════════════════════════════════════════════════════════ */
export function useSessionLogging({ s, me, log, sessions, logs, onSaved, active = true }) {
  const preview = usePreview(); // aperçu owner/staff → lecture seule
  const past = s.date <= todayISO();

  // 1RM du joueur → charge réelle des exercices exprimés en % (PR2).
  const { entries: my1rm } = usePlayer1RM(me.id);
  const rmByIdentity = useMemo(() => {
    const m = {};
    summarize1RM(my1rm).forEach((r) => { if (!r.missing) m[r.identity] = r; });
    return m;
  }, [my1rm]);
  const pctLoad = (e) => {
    if (!e?.pct) return null;
    const cur = rmByIdentity[movementIdentity({ exerciseId: e.rmExerciseId, name: e.rmLabel || e.name })];
    return { pct: e.pct, kg: cur ? computeLoadKg(e.pct, cur.value) : null, oneRM: cur?.value ?? null, label: e.rmLabel || e.name, kind: cur?.kind, missing: !cur };
  };

  // Nature EFFECTIVE de la séance → modèle de saisie des exercices « plats ».
  const effNature = effectiveNature(s.nature, s.code);

  // Chaque exercice DOIT porter un id UNIQUE et STABLE : l'état de saisie est
  // indexé par id (ex[e.id]). Repli DÉTERMINISTE par position (« x0, x1… »),
  // stable entre rendus — les logs (perExercise) sont indexés par ce même id.
  const exos = useMemo(
    () => (Array.isArray(s.exercises) ? s.exercises : []).map((e, i) => (e && e.id ? e : { ...e, id: `x${i}` })),
    [s.exercises],
  );

  // 1RM courant (kg) du mouvement d'un exercice, pour résoudre son setPlan.
  const exOneRM = (e) => {
    const cur = rmByIdentity[movementIdentity({ exerciseId: e.rmExerciseId, name: e.rmLabel || e.name })];
    return cur ? cur.value : null;
  };

  const init = () => {
    const b = {};
    exos.forEach((e) => {
      const k = exerciseInputModel(e, effNature);
      const saved = log?.perExercise?.[e.id];
      const pm = k === "conditioning" || k === "vitesse" || k === "mobility" ? parsePrescribedMetrics(e.presc) : null;
      if (k === "conditioning") {
        const m = saved && saved.kind === "effort_conditioning" ? saved : null;
        b[e.id] = { mono: { distanceM: m?.distanceM ?? pm.distanceM ?? "", durationSec: m?.durationSec ?? pm.durationSec ?? "", watts: m?.watts ?? pm.watts ?? "", kcal: m?.kcal ?? pm.kcal ?? "", hrAvg: m?.hrAvg ?? "", done: !!m?.done }, note: (m ? saved.note : "") || "" };
        return;
      }
      if (k === "vitesse") {
        const m = saved && saved.kind === "effort_vitesse" ? saved : null;
        b[e.id] = { mono: { distanceM: m?.distanceM ?? pm.distanceM ?? "", durationSec: m?.durationSec ?? pm.durationSec ?? "", reps: m?.reps ?? pm.reps ?? "", recoverySec: m?.recoverySec ?? pm.recoverySec ?? "", done: !!m?.done }, note: (m ? saved.note : "") || "" };
        return;
      }
      if (k === "mobility") {
        const m = saved && saved.kind === "effort_mobility" ? saved : null;
        b[e.id] = { mono: { durationSec: m?.durationSec ?? pm.durationSec ?? "", holdSec: m?.holdSec ?? pm.holdSec ?? "", holds: m?.holds ?? pm.reps ?? "", done: !!m?.done }, note: (m ? saved.note : "") || "" };
        return;
      }
      if (k === "cardio_continuous") {
        const m = saved && saved.kind === "cardio_continuous" ? saved : null;
        b[e.id] = { mono: { distanceM: m?.distanceM ?? "", durationSec: m?.durationSec ?? "", hrAvg: m?.hrAvg ?? "", done: !!m?.done }, note: (m ? saved.note : "") || "" };
        return;
      }
      if (k === "cardio_circuit") {
        const m = saved && saved.kind === "cardio_circuit" ? saved : null;
        b[e.id] = { mono: { roundsDone: m?.roundsDone ?? "", done: !!m?.done }, note: (m ? saved.note : "") || "" };
        return;
      }
      if (k === "cardio_test") {
        const m = saved && saved.kind === "cardio_test" ? saved : null;
        b[e.id] = { mono: { value: m?.value ?? "", done: !!m?.done }, note: (m ? saved.note : "") || "" };
        return;
      }
      if (k === "cardio_interval") {
        const n = Array.isArray(e.repPlan) && e.repPlan.length ? e.repPlan.length : (Number(e.reps) > 0 ? Number(e.reps) : 4);
        const sv = saved && Array.isArray(saved.reps) ? saved.reps : null;
        b[e.id] = { sets: Array.from({ length: n }, (_, i) => ({ done: !!sv?.[i]?.done, actual: sv?.[i]?.actual ?? "" })), note: saved?.note || "" };
        return;
      }
      // Set-like : muscu / poids de corps / skill. Pré-remplissage centralisé
      // dans un helper PUR ; la saisie du joueur (saved) prime toujours.
      b[e.id] = initSetLikeSets(e, { saved, oneRM: exOneRM(e) });
    });
    return b;
  };

  const [ex, setEx] = useState(init);
  const [rpe, setRpe] = useState(log?.rpe || null);
  const [fb, setFb] = useState(log?.feedback || "");
  const plannedDur = s.dur || 60;
  const [dur, setDur] = useState(log?.duration || plannedDur);
  const [rest, setRest] = useState(null);
  const [justPR, setJustPR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const st = log?.status || "pending";

  // SOUVERAINETÉ : resync depuis la version PERSISTÉE quand sa signature change,
  // MAIS jamais si une saisie non enregistrée est en cours (`dirty`).
  const [dirty, setDirty] = useState(false);
  const savedSig = log ? `${log.status}|${log.rpe ?? ""}|${JSON.stringify(log.perExercise || {})}` : "";
  const lastSig = useRef(savedSig);
  useEffect(() => {
    if (savedSig === lastSig.current) return;
    lastSig.current = savedSig;
    if (dirty) return;
    setEx(init());
    setRpe(log?.rpe || null);
    setFb(log?.feedback || "");
    setDur(log?.duration || plannedDur);
  }, [savedSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chrono optionnel : au premier affichage d'une séance non terminée, note
  // l'heure d'ouverture puis rafraîchit la durée écoulée chaque minute.
  useEffect(() => {
    if (!active || st === "done" || preview) return;
    if (startedAt == null) setStartedAt(Date.now());
  }, [active, st, preview, startedAt]);
  useEffect(() => {
    if (startedAt == null) return;
    const tick = () => setElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 60000)));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startedAt]);

  // 1RM renseigné/corrigé DEPUIS la séance : pré-remplit les séries VIDES de CET
  // exercice uniquement — jamais d'écrasement d'une valeur déjà saisie.
  const applyOneRM = (e, oneRMkg) => {
    const stt = ex[e.id];
    if (!stt?.sets?.length) return;
    const sets = fillEmptySetsFromOneRM(stt.sets, e, oneRMkg);
    if (sets === stt.sets) return;
    setDirty(true);
    setEx((v) => ({ ...v, [e.id]: { ...v[e.id], sets } }));
  };

  const setSet = (eid, i, patch) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], sets: v[eid].sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } })); };
  const addSet = (eid) => { setDirty(true); setEx((v) => { const arr = v[eid].sets; const last = arr[arr.length - 1] || { w: "", reps: "" }; return { ...v, [eid]: { ...v[eid], sets: [...arr, { w: last.w, reps: last.reps, type: "normal", done: false }] } }; }); };
  const delSet = (eid, i) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], sets: v[eid].sets.filter((_, j) => j !== i) } })); };
  const setExNote = (eid, note) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], note } })); };
  const setMono = (eid, patch) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], mono: { ...v[eid].mono, ...patch } } })); };
  const numOrU = (v) => (Number(v) > 0 ? Number(v) : undefined);

  // Unités faites / total d'un bloc, tous kinds (séries, répétitions, ou 1 mono).
  const blockUnits = (e) => {
    const stt = ex[e.id];
    if (!stt) return { done: 0, total: 0 };
    if (stt.sets) return { done: stt.sets.filter((x) => x.done).length, total: stt.sets.length };
    if (stt.mono) return { done: stt.mono.done ? 1 : 0, total: 1 };
    return { done: 0, total: 0 };
  };

  const toggleSet = (e, i) => {
    const cur = ex[e.id].sets[i];
    const willDo = !cur.done;
    setSet(e.id, i, { done: willDo });
    if (willDo) {
      setRest({ sec: e.rest || 90, k: Date.now() });
      const rec = exerciseRecords(logs, sessions, me.id, e.name, s.date);
      const w = +cur.w, reps = +cur.reps;
      if (w > 0 && reps > 0) {
        const orm = e1RM(w, reps);
        if (rec.n > 0 && (w > rec.top || orm > rec.oneRM)) {
          setJustPR({ ex: e.name, w, orm });
          setTimeout(() => setJustPR(null), 3500);
        }
      }
    }
  };

  const summarize = (peSets) => {
    const ws = peSets.filter((x) => x.type !== "warmup" && x.done);
    const top = ws.reduce((m, x) => Math.max(m, +x.w || 0), 0);
    return { charge: top || "", reps: ws.length ? `${ws.length}×` : "", rpe: "" };
  };

  const valider = async (status) => {
    if (preview) return; // lecture seule : aucune écriture sous l'identité du joueur
    setBusy(true);
    const pe = {};
    exos.forEach((e) => {
      const k = exerciseInputModel(e, effNature); const stt = ex[e.id];
      if (k === "conditioning") {
        const m = stt.mono || {};
        pe[e.id] = { kind: "effort_conditioning", distanceM: numOrU(m.distanceM), durationSec: numOrU(m.durationSec), watts: numOrU(m.watts), kcal: numOrU(m.kcal), hrAvg: numOrU(m.hrAvg), done: !!m.done, note: (stt.note || "").trim() };
      } else if (k === "vitesse") {
        const m = stt.mono || {};
        pe[e.id] = { kind: "effort_vitesse", distanceM: numOrU(m.distanceM), durationSec: numOrU(m.durationSec), reps: numOrU(m.reps), recoverySec: numOrU(m.recoverySec), done: !!m.done, note: (stt.note || "").trim() };
      } else if (k === "mobility") {
        const m = stt.mono || {};
        pe[e.id] = { kind: "effort_mobility", durationSec: numOrU(m.durationSec), holdSec: numOrU(m.holdSec), holds: numOrU(m.holds), done: !!m.done, note: (stt.note || "").trim() };
      } else if (k === "cardio_continuous") {
        const m = stt.mono || {};
        pe[e.id] = { kind: k, distanceM: numOrU(m.distanceM), durationSec: numOrU(m.durationSec), hrAvg: numOrU(m.hrAvg), done: !!m.done, note: (stt.note || "").trim() };
      } else if (k === "cardio_interval") {
        pe[e.id] = { kind: k, reps: (stt.sets || []).map((x) => ({ done: !!x.done, actual: x.actual ?? "" })), note: (stt.note || "").trim() };
      } else if (k === "cardio_circuit") {
        const m = stt.mono || {};
        pe[e.id] = { kind: k, roundsDone: numOrU(m.roundsDone), done: !!m.done, note: (stt.note || "").trim() };
      } else if (k === "cardio_test") {
        const m = stt.mono || {};
        pe[e.id] = { kind: k, value: String(m.value ?? "").trim(), unit: (testMeta(e.testKey)?.unit || "").trim(), done: !!m.done, note: (stt.note || "").trim() };
      } else {
        const sets = stt.sets; pe[e.id] = { sets, note: (stt.note || "").trim(), ...summarize(sets) };
      }
    });
    try {
      await saveLog(s.id, me.id, { status, rpe: status === "done" ? rpe : null, perExercise: status === "done" ? pe : {}, feedback: fb, duration: status === "done" ? Number(dur) || plannedDur : null });
      setDirty(false); // enregistré → la resync depuis la base est de nouveau autorisée
      onSaved && onSaved();
      return true;
    } catch (e) {
      console.error("[saveLog]", e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doneSets = exos.reduce((a, e) => a + blockUnits(e).done, 0);
  const totSets = exos.reduce((a, e) => a + blockUnits(e).total, 0);

  return {
    preview, past, effNature, exos,
    ex, rpe, fb, dur, plannedDur, st,
    rest, setRest, justPR, busy,
    startedAt, elapsed,
    rmByIdentity, pctLoad, exOneRM, applyOneRM,
    setSet, addSet, delSet, setExNote, setMono, toggleSet,
    setRpe, setFb, setDur, setDirty,
    blockUnits, doneSets, totSets,
    valider,
  };
}
