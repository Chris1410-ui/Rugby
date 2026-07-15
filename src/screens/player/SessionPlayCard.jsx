import { useEffect, useRef, useState } from "react";
import { C, CODES } from "../../lib/tokens.js";
import { fmtShort, todayISO } from "../../lib/metrics.js";
import { Dot, Tag, RestTimer, LineChart } from "../../lib/ui.jsx";
import { CheckCircle, Trophy, TrendingUp, X, Video, ExternalLink } from "../../lib/icons.jsx";
import { youtubeEmbed, safeVideoUrl } from "../../lib/youtube.js";
import {
  e1RM, SET_TYPES, nextSetType, parseSetsN,
  lastExercisePerf, exerciseRecords, exerciseHistory,
} from "../../lib/hevy.js";
import { saveLog } from "../../data/logs.js";

const playInp = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" };

/* Logging set-par-set façon Hevy — porté du prototype (persistance Supabase). */
export default function SessionPlayCard({ s, me, log, sessions, logs, accent, onSaved }) {
  const past = s.date <= todayISO();
  const [open, setOpen] = useState(false);
  const [rest, setRest] = useState(null);
  const [justPR, setJustPR] = useState(null);
  const [graphEx, setGraphEx] = useState(null);
  const [busy, setBusy] = useState(false);

  const init = () => {
    const b = {};
    s.exercises.forEach((e) => {
      const saved = log?.perExercise?.[e.id];
      if (saved?.sets) b[e.id] = { sets: saved.sets.map((x) => ({ ...x })) };
      else {
        const n = parseSetsN(e.sets);
        const prev = lastExercisePerf(logs, sessions, me.id, e.name, s.date);
        b[e.id] = { sets: Array.from({ length: n }, (_, i) => ({ w: prev?.sets?.[i]?.w || e.charge || "", reps: e.reps || "", type: "normal", done: false })) };
      }
    });
    return b;
  };
  const [ex, setEx] = useState(init);
  const [rpe, setRpe] = useState(log?.rpe || null);
  const [fb, setFb] = useState(log?.feedback || "");
  const st = log?.status || "pending";

  // Persistance (#4) : le log peut arriver APRÈS le montage (fetch async), ou
  // être mis à jour par le Realtime. `useState(init)` ne se rejoue jamais → sans
  // ceci, une séance déjà terminée s'afficherait vide tant que le log n'était
  // pas chargé au 1er rendu. On resynchronise depuis la version PERSISTÉE quand
  // sa signature change, MAIS seulement si l'utilisateur n'a pas de saisie non
  // enregistrée en cours (`dirty`) — les données non enregistrées peuvent
  // disparaître, les données enregistrées sont toujours reflétées.
  const [dirty, setDirty] = useState(false);
  const savedSig = log ? `${log.status}|${log.rpe ?? ""}|${JSON.stringify(log.perExercise || {})}` : "";
  const lastSig = useRef(savedSig);
  useEffect(() => {
    if (savedSig === lastSig.current) return;
    lastSig.current = savedSig;
    if (dirty) return; // ne jamais écraser une saisie en cours non enregistrée
    setEx(init());
    setRpe(log?.rpe || null);
    setFb(log?.feedback || "");
  }, [savedSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSet = (eid, i, patch) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], sets: v[eid].sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } })); };
  const addSet = (eid) => { setDirty(true); setEx((v) => { const arr = v[eid].sets; const last = arr[arr.length - 1] || { w: "", reps: "" }; return { ...v, [eid]: { ...v[eid], sets: [...arr, { w: last.w, reps: last.reps, type: "normal", done: false }] } }; }); };
  const delSet = (eid, i) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], sets: v[eid].sets.filter((_, j) => j !== i) } })); };

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
    setBusy(true);
    const pe = {};
    s.exercises.forEach((e) => { const sets = ex[e.id].sets; pe[e.id] = { sets, ...summarize(sets) }; });
    try {
      await saveLog(s.id, me.id, { status, rpe: status === "done" ? rpe : null, perExercise: status === "done" ? pe : {}, feedback: fb });
      setDirty(false); // enregistré → la resync depuis la base est de nouveau autorisée
      setOpen(false); setRest(null);
      onSaved && onSaved();
    } catch (e) {
      // garde la carte ouverte ; l'erreur est rare (RLS/connexion)
      console.error("[saveLog]", e.message);
    }
    setBusy(false);
  };

  const doneSets = s.exercises.reduce((a, e) => a + ex[e.id].sets.filter((x) => x.done).length, 0);
  const totSets = s.exercises.reduce((a, e) => a + ex[e.id].sets.length, 0);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${st === "done" ? C.green : st === "missed" ? C.coral : accent}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <Dot s={st} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>{fmtShort(s.date)}</span>
            <Tag c={CODES[s.code] || accent}>{s.code}</Tag>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{s.titre}</span>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{s.exercises.length} exercices · {totSets} séries</div>
        </div>
        {st === "done" && rpe && <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>RPE {rpe}</span>}
        {st === "pending" && past && <Tag c={C.amb}>À valider</Tag>}
        {st === "pending" && !past && <Tag c={accent}>À venir</Tag>}
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {justPR && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${C.amb}22`, border: `1px solid ${C.amb}66`, borderRadius: 9, padding: "8px 12px", marginBottom: 10 }}>
              <Trophy size={15} color={C.amb} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.amb }}>Record ! {justPR.ex} — {justPR.w}kg (1RM ~{justPR.orm})</span>
            </div>
          )}
          {rest && <RestTimer key={rest.k} seconds={rest.sec} accent={accent} onDone={() => setRest(null)} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1 }}>SÉRIES — COCHE POUR VALIDER</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: doneSets === totSets && totSets ? C.green : "rgba(255,255,255,0.5)" }}>{doneSets}/{totSets}</span>
          </div>

          {s.exercises.map((e) => {
            const prev = lastExercisePerf(logs, sessions, me.id, e.name, s.date);
            const rec = exerciseRecords(logs, sessions, me.id, e.name, s.date);
            return (
              <div key={e.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
                  <button onClick={() => setGraphEx(e.name)} title="Progression" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}>
                    <TrendingUp size={13} />
                  </button>
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", marginBottom: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>Cible {e.sets}×{e.reps}{e.charge ? ` @ ${e.charge}` : ""}</span>
                  <span>Préc. : {prev ? prev.sets.map((x) => `${x.w || "–"}×${x.reps || "–"}`).join("  ") : "—"}</span>
                  {rec.top > 0 && <span style={{ color: C.amb }}>🏆 {rec.top}kg · 1RM {rec.oneRM}</span>}
                </div>
                <ExerciseVideo url={e.video} accent={accent} />
                {ex[e.id].sets.map((x, i) => {
                  const stype = SET_TYPES[x.type] || SET_TYPES.normal;
                  const ph = prev?.sets?.[i];
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 34px", gap: 6, alignItems: "center", marginBottom: 5 }}>
                      <button onClick={() => setSet(e.id, i, { type: nextSetType(x.type) })} title={stype.name} style={{ height: 32, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", color: stype.c, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{stype.l}</button>
                      <input value={x.w} onChange={(ev) => setSet(e.id, i, { w: ev.target.value })} placeholder={ph ? `${ph.w || "–"}` : "kg"} inputMode="decimal" style={{ ...playInp, opacity: x.done ? 0.6 : 1 }} />
                      <input value={x.reps} onChange={(ev) => setSet(e.id, i, { reps: ev.target.value })} placeholder={ph ? `${ph.reps || "–"} reps` : "reps"} inputMode="numeric" style={{ ...playInp, opacity: x.done ? 0.6 : 1 }} />
                      <button onClick={() => toggleSet(e, i)} style={{ height: 32, borderRadius: 6, border: x.done ? "none" : `1px solid ${C.border}`, background: x.done ? C.green : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <CheckCircle size={15} color={x.done ? "#fff" : "rgba(255,255,255,0.3)"} />
                      </button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button onClick={() => addSet(e.id)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ série</button>
                  {ex[e.id].sets.length > 1 && <button onClick={() => delSet(e.id, ex[e.id].sets.length - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.56)", fontSize: 10, cursor: "pointer" }}>− retirer</button>}
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "12px 0 8px" }}>RPE global de la séance (1–10)</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} onClick={() => { setDirty(true); setRpe(n); }} style={{ flex: 1, height: 32, borderRadius: 6, background: rpe === n ? (n <= 3 ? C.green : n <= 6 ? C.amb : C.coral) : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, cursor: "pointer", border: rpe === n ? "2px solid rgba(255,255,255,0.4)" : "2px solid transparent" }}>{n}</div>
            ))}
          </div>
          <textarea value={fb} onChange={(e) => { setDirty(true); setFb(e.target.value); }} placeholder="Commentaire (douleur, ressenti…)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "none", height: 50, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => valider("done")} disabled={busy} style={{ flex: 1, background: C.green, border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
              <CheckCircle size={13} />{st === "done" ? "Mettre à jour" : "Terminer la séance"}
            </button>
            <button onClick={() => valider("missed")} disabled={busy} style={{ flex: 1, background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 8, padding: "10px", color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Séance manquée</button>
          </div>
        </div>
      )}

      {graphEx && <ExoProgressModal pid={me.id} exName={graphEx} sessions={sessions} logs={logs} accent={accent} onClose={() => setGraphEx(null)} />}
    </div>
  );
}

/* Vidéo de démonstration d'un exercice (#1). Lecteur YouTube intégré à la
   demande (iframe) ; sinon lien cliquable brut (autre hébergeur). Rien à
   afficher si l'exercice n'a pas de lien exploitable. */
function ExerciseVideo({ url, accent }) {
  const [open, setOpen] = useState(false);
  const embed = youtubeEmbed(url);
  const href = safeVideoUrl(url);
  if (!href) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {embed ? (
          <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "5px 10px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            <Video size={13} /> {open ? "Masquer la vidéo" : "Voir la démo"}
          </button>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "5px 10px", color: accent, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
            <ExternalLink size={13} /> Voir la vidéo
          </a>
        )}
        {embed && (
          <a href={href} target="_blank" rel="noopener noreferrer" title="Ouvrir sur YouTube" style={{ display: "inline-flex", alignItems: "center", color: "rgba(255,255,255,0.5)" }}>
            <ExternalLink size={13} />
          </a>
        )}
      </div>
      {open && embed && (
        <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", marginTop: 8, borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <iframe
            src={embed}
            title="Démonstration de l'exercice"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}
    </div>
  );
}

function ExoProgressModal({ pid, exName, sessions, logs, accent, onClose }) {
  const hist = exerciseHistory(logs, sessions, pid, exName);
  const pts = hist.map((h) => h.best1rm || h.top);
  const rec = { top: Math.max(0, ...hist.map((h) => h.top)), oneRM: Math.max(0, ...hist.map((h) => h.best1rm)) };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, background: C.panel, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ fontSize: 15, fontWeight: 800 }}>{exName}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Progression · 1RM estimé</div></div>
          <X size={20} color="rgba(255,255,255,0.5)" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        {pts.length >= 2 ? (
          <>
            <LineChart pts={pts} color={accent} height={130} />
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.amb }}>{rec.top}<span style={{ fontSize: 11 }}>kg</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>RECORD CHARGE</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{rec.oneRM}<span style={{ fontSize: 11 }}>kg</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>1RM ESTIMÉ</div></div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Pas encore assez d'historique pour tracer une progression. Valide au moins deux séances avec cet exercice.</div>
        )}
      </div>
    </div>
  );
}
