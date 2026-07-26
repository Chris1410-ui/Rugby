import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { fmtShort, todayISO } from "../../lib/metrics.js";
import { Dot, Tag, NatureTag, RestTimer, LineChart, CloseX, useModalClose } from "../../lib/ui.jsx";
import { CheckCircle, Trophy, TrendingUp, Video, ExternalLink, FileText, BookOpen, Users } from "../../lib/icons.jsx";
import { youtubeEmbed, safeVideoUrl } from "../../lib/youtube.js";
import {
  e1RM, SET_TYPES, nextSetType, parseSetsN,
  lastExercisePerf, exerciseRecords, exerciseHistory, prescribedVsRealized,
} from "../../lib/hevy.js";
import { saveLog } from "../../data/logs.js";
import { getProgramDoc } from "../../data/programDocs.js";
import { usePlayer1RM, add1RM } from "../../data/player1rm.js";
import { useExercisePerf } from "../../data/exercisePerf.js";
import { summarize1RM, computeLoadKg, movementIdentity } from "../../lib/oneRM.js";
import ProgramView from "../shared/ProgramView.jsx";
import ExerciseInfoModal from "../shared/ExerciseInfoModal.jsx";
import { usePreview } from "../../lib/preview.js";

const playInp = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" };

/* Logging set-par-set façon Hevy — porté du prototype (persistance Supabase). */
export default function SessionPlayCard({ s, me, log, sessions, logs, accent, onSaved, onDelete }) {
  const { t } = useTranslation();
  const preview = usePreview(); // aperçu owner/staff → lecture seule
  const past = s.date <= todayISO();
  const [open, setOpen] = useState(false);
  const [rest, setRest] = useState(null);
  const [justPR, setJustPR] = useState(null);
  const [graphEx, setGraphEx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [proto, setProto] = useState(null);        // protocole source ouvert en lecture
  const [protoBusy, setProtoBusy] = useState(false);
  const [infoEx, setInfoEx] = useState(null);      // fiche exercice (nom) ouverte
  const [set1rm, setSet1rm] = useState(null);      // { label } : saisie rapide 1RM manquant

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
    return { pct: e.pct, kg: cur ? computeLoadKg(e.pct, cur.value) : null, label: e.rmLabel || e.name, kind: cur?.kind, missing: !cur };
  };

  // Ouvre le PROTOCOLE source complet (consignes, sécurité, progression) en lecture.
  const openProtocol = async () => {
    if (!s.programDocId || protoBusy) return;
    setProtoBusy(true);
    try { const full = await getProgramDoc(s.programDocId); setProto({ id: full.id, title: full.title, doc: full.doc }); }
    catch (e) { console.error("[protocol read]", e.message); }
    setProtoBusy(false);
  };

  const init = () => {
    const b = {};
    s.exercises.forEach((e) => {
      const saved = log?.perExercise?.[e.id];
      if (saved?.sets) b[e.id] = { sets: saved.sets.map((x) => ({ ...x })), note: saved.note || "" };
      else {
        const n = parseSetsN(e.sets);
        const prev = lastExercisePerf(logs, sessions, me.id, e.name, s.date);
        b[e.id] = { sets: Array.from({ length: n }, (_, i) => ({ w: prev?.sets?.[i]?.w || e.charge || "", reps: e.reps || "", type: "normal", done: false })), note: "" };
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
  const setExNote = (eid, note) => { setDirty(true); setEx((v) => ({ ...v, [eid]: { ...v[eid], note } })); };

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
    s.exercises.forEach((e) => { const sets = ex[e.id].sets; pe[e.id] = { sets, note: (ex[e.id].note || "").trim(), ...summarize(sets) }; });
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

  // Séance-test : les résultats sont saisis par le staff → carte informative,
  // pas de logging set-par-set côté joueur.
  if (s.code === "TEST") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: 14, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>🧪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{fmtShort(s.date)} · {s.titre}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("player.session.testHint")}</div>
        </div>
        <Tag c={C.blue}>{t("player.session.testTag")}</Tag>
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${st === "done" ? C.green : st === "missed" ? C.coral : st === "postponed" ? C.gray : accent}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <Dot s={st} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>{fmtShort(s.date)}</span>
            <Tag c={CODES[s.code] || accent} title={sessionCodeLabel(t, s.code)}>{s.code}</Tag>
            <NatureTag nature={s.nature} code={s.code} />
            {s.origin === "libre" && <Tag c={C.viol}>{t("player.session.freeTag")}</Tag>}
            <span style={{ fontSize: 12, fontWeight: 600 }}>{s.titre}</span>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("player.session.exercisesSeries", { ex: s.exercises.length, sets: totSets })}</div>
        </div>
        {st === "done" && rpe && <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{t("player.session.rpeShort")} {rpe}</span>}
        {st === "pending" && past && <Tag c={C.amb}>{t("player.session.toValidate")}</Tag>}
        {st === "pending" && !past && <Tag c={accent}>{t("player.session.upcoming")}</Tag>}
        {st === "postponed" && <Tag c={C.gray}>{t("player.session.postponed")}</Tag>}
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {justPR && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${C.amb}22`, border: `1px solid ${C.amb}66`, borderRadius: 9, padding: "8px 12px", marginBottom: 10 }}>
              <Trophy size={15} color={C.amb} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.amb }}>{t("player.session.record", { ex: justPR.ex, w: justPR.w, orm: justPR.orm })}</span>
            </div>
          )}
          {rest && <RestTimer key={rest.k} seconds={rest.sec} accent={accent} onDone={() => setRest(null)} />}

          {s.programDocId && (
            <button onClick={openProtocol} disabled={protoBusy} style={{ width: "100%", marginBottom: 10, background: `${C.viol}18`, border: `1px solid ${C.viol}55`, borderRadius: 9, padding: "9px 12px", color: C.viol, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <FileText size={14} /> {protoBusy ? t("player.session.protocolLoading") : t("player.session.viewProtocol")}{s.sourceWeek ? ` · ${t("player.session.weekN", { n: s.sourceWeek })}` : ""}
            </button>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1 }}>{t("player.session.setsHeader")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: doneSets === totSets && totSets ? C.green : "rgba(255,255,255,0.5)" }}>{doneSets}/{totSets}</span>
          </div>

          {s.exercises.map((e) => {
            const prev = lastExercisePerf(logs, sessions, me.id, e.name, s.date);
            const rec = exerciseRecords(logs, sessions, me.id, e.name, s.date);
            const cmp = prescribedVsRealized(e, { sets: ex[e.id].sets }); // prescrit vs réalisé (live)
            const pl = pctLoad(e); // charge calculée depuis le 1RM si exprimé en %
            const ecart = cmp.diff
              ? [cmp.setsDiff ? t("player.session.setsDiff", { done: cmp.doneSets, presc: cmp.prescSets }) : null,
                 cmp.chargeDiff ? t("player.session.chargeDiff", { real: cmp.realTop, presc: cmp.prescCharge }) : null]
                .filter(Boolean).join(" · ")
              : "";
            return (
              <div key={e.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setInfoEx(e.name)} title={t("player.session.exInfo")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex" }}>
                      <BookOpen size={13} />
                    </button>
                    <button onClick={() => setGraphEx(e.name)} title={t("player.session.progressTitle")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}>
                      <TrendingUp size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", marginBottom: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{t("player.session.prescribed")} {e.presc || `${e.sets}×${e.reps}${e.charge ? ` @ ${e.charge}` : ""}`}{e.tempo ? ` · ${t("player.session.tempo")} ${e.tempo}` : ""}{e.rest ? ` · ${t("player.session.restPresc", { n: e.rest })}` : ""}</span>
                  <span>{t("player.session.prev")} {prev ? prev.sets.map((x) => `${x.w || "–"}×${x.reps || "–"}`).join("  ") : "—"}</span>
                  {rec.top > 0 && <span style={{ color: C.amb }}>{t("player.session.recBadge", { top: rec.top, orm: rec.oneRM })}</span>}
                </div>
                {e.note && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 6, fontStyle: "italic" }}>💬 {e.note}</div>}
                {pl && (
                  <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", color: pl.kg != null ? C.viol : C.amb }}>
                    <span>{pl.pct}%</span>
                    {pl.kg != null ? (
                      <>
                        <span>· {pl.kg} {t("player.session.kg")}</span>
                        {pl.kind === "estime" && <span style={{ fontSize: 9, fontWeight: 700, color: C.amb }}>({t("oneRM.estimated")})</span>}
                      </>
                    ) : (
                      <button onClick={() => setSet1rm({ label: pl.label })} style={{ fontWeight: 800, color: C.amb, background: `${C.amb}18`, border: `1px solid ${C.amb}55`, borderRadius: 5, padding: "1px 7px", cursor: "pointer" }}>· {t("player.session.setYour1RM", { movement: pl.label })}</button>
                    )}
                  </div>
                )}
                {ecart && (
                  <div style={{ fontSize: 10, color: C.amb, marginBottom: 6, display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                    <span>{t("player.session.gap")}</span><span style={{ fontWeight: 600 }}>{ecart}</span>
                  </div>
                )}
                <ExerciseVideo url={e.video} accent={accent} />
                {ex[e.id].sets.map((x, i) => {
                  const stype = SET_TYPES[x.type] || SET_TYPES.normal;
                  const ph = prev?.sets?.[i];
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 34px", gap: 6, alignItems: "center", marginBottom: 5 }}>
                      <button onClick={() => setSet(e.id, i, { type: nextSetType(x.type) })} title={stype.name} style={{ height: 32, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", color: stype.c, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{stype.l}</button>
                      <input value={x.w} onChange={(ev) => setSet(e.id, i, { w: ev.target.value })} placeholder={ph?.w ? `${ph.w}` : (pl?.kg != null ? `${pl.kg}` : "kg")} inputMode="decimal" style={{ ...playInp, opacity: x.done ? 0.6 : 1 }} />{/* i18n-ok: unité kg */}
                      <input value={x.reps} onChange={(ev) => setSet(e.id, i, { reps: ev.target.value })} placeholder={ph?.reps ? `${ph.reps}` : (e.reps || "reps")} style={{ ...playInp, opacity: x.done ? 0.6 : 1 }} />{/* i18n-ok: placeholder = consigne prescrite (unité adaptée : reps, watts, kcal, min…) */}
                      <button onClick={() => toggleSet(e, i)} style={{ height: 32, borderRadius: 6, border: x.done ? "none" : `1px solid ${C.border}`, background: x.done ? C.green : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <CheckCircle size={15} color={x.done ? "#fff" : "rgba(255,255,255,0.3)"} />
                      </button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button onClick={() => addSet(e.id)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{t("player.session.addSet")}</button>
                  {ex[e.id].sets.length > 1 && <button onClick={() => delSet(e.id, ex[e.id].sets.length - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.56)", fontSize: 10, cursor: "pointer" }}>{t("player.session.removeSet")}</button>}
                </div>
                <textarea
                  value={ex[e.id].note || ""}
                  onChange={(ev) => setExNote(e.id, ev.target.value)}
                  placeholder={ecart ? t("player.session.exNoteGap") : t("player.session.exNote")}
                  style={{ width: "100%", marginTop: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${ecart ? `${C.amb}55` : C.border}`, borderRadius: 7, padding: "6px 9px", color: "#fff", fontSize: 11.5, outline: "none", resize: "none", height: 34 }}
                />
              </div>
            );
          })}

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "12px 0 8px" }}>{t("player.session.rpeLabel")}</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} onClick={() => { setDirty(true); setRpe(n); }} style={{ flex: 1, height: 32, borderRadius: 6, background: rpe === n ? (n <= 3 ? C.green : n <= 6 ? C.amb : C.coral) : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, cursor: "pointer", border: rpe === n ? "2px solid rgba(255,255,255,0.4)" : "2px solid transparent" }}>{n}</div>
            ))}
          </div>
          <textarea value={fb} onChange={(e) => { setDirty(true); setFb(e.target.value); }} placeholder={t("player.session.feedbackPlaceholder")} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "none", height: 50, marginBottom: 10 }} />
          {preview ? (
            <div style={{ textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700 }}>
              {t("player.session.previewSession")}
            </div>
          ) : (
            <>
              <button onClick={() => valider("done")} disabled={busy} style={{ width: "100%", background: C.green, border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1, marginBottom: 8 }}>
                <CheckCircle size={13} />{st === "done" ? t("player.session.update") : t("player.session.finish")}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => valider("missed")} disabled={busy} style={{ flex: 1, background: "rgba(232,85,59,0.12)", border: `1px solid ${C.coral}44`, borderRadius: 8, padding: "10px", color: C.coral, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("player.session.missed")}</button>
                <button onClick={() => valider("postponed")} disabled={busy} title={t("player.session.postponeTitle")} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("player.session.postpone")}</button>
              </div>
            </>
          )}
          {!preview && s.origin === "libre" && onDelete && (
            <button onClick={() => onDelete(s)} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
              {t("player.session.deleteFree")}
            </button>
          )}
        </div>
      )}

      {graphEx && <ExoProgressModal pid={me.id} exName={graphEx} sessions={sessions} logs={logs} accent={accent} onClose={() => setGraphEx(null)} />}
      {proto && <ProgramView id={proto.id} doc={proto.doc} title={proto.title} onClose={() => setProto(null)} />}
      {infoEx && <ExerciseInfoModal name={infoEx} onClose={() => setInfoEx(null)} />}
      {set1rm && !preview && <Quick1RM label={set1rm.label} me={me} t={t} onClose={() => setSet1rm(null)} />}
    </div>
  );
}

/* Saisie rapide, par le JOUEUR, de son 1RM manquant pour un mouvement (depuis la
   carte de séance quand une consigne @% n'a pas de 1RM). add1RM source 'player'. */
function Quick1RM({ label, me, t, onClose }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!(Number(v) > 0)) return;
    setBusy(true);
    try { await add1RM(me.team, me.id, { name: label, valueKg: v, source: "player" }); onClose(); }
    catch (e) { console.error("[quick1rm]", e.message); setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: C.panel, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{t("player.session.set1rmTitle", { movement: label })}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>{t("player.session.set1rmHint")}</div>
        <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" autoFocus placeholder={t("oneRM.kg")} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", textAlign: "center", marginBottom: 12, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, background: C.green, border: "none", borderRadius: 9, padding: 11, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("player.session.set1rmSave")}</button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 9, padding: "11px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/* Vidéo de démonstration d'un exercice (#1). Lecteur YouTube intégré à la
   demande (iframe) ; sinon lien cliquable brut (autre hébergeur). Rien à
   afficher si l'exercice n'a pas de lien exploitable. */
function ExerciseVideo({ url, accent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const embed = youtubeEmbed(url);
  const href = safeVideoUrl(url);
  if (!href) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {embed ? (
          <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "5px 10px", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            <Video size={13} /> {open ? t("player.session.hideVideo") : t("player.session.showDemo")}
          </button>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 7, padding: "5px 10px", color: accent, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
            <ExternalLink size={13} /> {t("player.session.seeVideo")}
          </a>
        )}
        {embed && (
          <a href={href} target="_blank" rel="noopener noreferrer" title={t("player.session.openYoutube")} style={{ display: "inline-flex", alignItems: "center", color: "rgba(255,255,255,0.5)" }}>
            <ExternalLink size={13} />
          </a>
        )}
      </div>
      {open && embed && (
        <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", marginTop: 8, borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <iframe
            src={embed}
            title={t("player.session.videoTitle")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}
    </div>
  );
}

// Une barre horizontale de comparaison (valeur rapportée au max de la vue).
function CmpBar({ label, sub, value, max, color, unit }) {
  const pct = value > 0 && max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{label}{sub ? <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}> · {sub}</span> : null}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{value != null ? `${value} ${unit}` : "—"}</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width .3s" }} />
      </div>
    </div>
  );
}

/* Vue joueur d'un exercice : progression personnelle (issue de exercise_perf,
   donc du réalisé) + comparaison ANONYMISÉE moi / ma ligne / mon équipe. Les
   moyennes ligne/équipe ne sont renvoyées par le serveur qu'à partir de 5
   joueurs (k-anonymat) ; en deçà, on affiche un message, jamais de valeur. */
function ExoProgressModal({ pid, exName, sessions, logs, accent, onClose }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const { series, agg, loading } = useExercisePerf(exName, true);

  // Série personnelle depuis exercise_perf ; repli sur l'historique client
  // (compatibilité d'anciens logs) si le serveur ne renvoie rien.
  const srvPts = (series || []).map((s) => s.est1rm || s.topKg || 0).filter((v) => v > 0);
  const hist = exerciseHistory(logs, sessions, pid, exName);
  const pts = srvPts.length >= 2 ? srvPts : hist.map((h) => h.best1rm || h.top);
  const rec = series && series.length
    ? { top: Math.max(0, ...series.map((s) => s.topKg || 0)), oneRM: Math.max(0, ...series.map((s) => s.est1rm || 0)) }
    : { top: Math.max(0, ...hist.map((h) => h.top)), oneRM: Math.max(0, ...hist.map((h) => h.best1rm)) };

  const me = agg?.me;
  const lineAgg = agg?.lineAgg;
  const teamAgg = agg?.teamAgg;
  const cmpMax = Math.max(me?.orm || 0, lineAgg?.orm || 0, teamAgg?.orm || 0);
  const hasCmp = (me?.orm || 0) > 0 && (lineAgg || teamAgg);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", padding: "16px 12px", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, background: C.panel, borderRadius: 18, padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ fontSize: 15, fontWeight: 800 }}>{exName}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("player.session.progressSub")}</div></div>
          <CloseX onClose={onClose} />
        </div>

        {pts.length >= 2 ? (
          <>
            <LineChart pts={pts} color={accent} height={130} />
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.amb }}>{rec.top}<span style={{ fontSize: 11 }}>{t("player.session.kg")}</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{t("player.session.recordLoad")}</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{rec.oneRM}<span style={{ fontSize: 11 }}>{t("player.session.kg")}</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{t("player.session.estimated1rm")}</div></div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{t("player.session.notEnoughHistory")}</div>
        )}

        {/* Comparaison anonymisée */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Users size={13} style={{ color: "rgba(255,255,255,0.7)" }} />
            <span style={{ fontSize: 12, fontWeight: 800 }}>{t("player.session.cmpTitle")}</span>
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>{t("player.session.cmpSub")}</div>

          {loading && !agg ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", padding: "8px 0" }}>{t("common.loading")}</div>
          ) : hasCmp ? (
            <>
              <CmpBar label={t("player.session.cmpMe")} value={me.orm} max={cmpMax} color={accent} unit={t("player.session.kg")} />
              {lineAgg
                ? <CmpBar label={t("player.session.cmpLine")} sub={t("player.session.cmpPlayers", { count: lineAgg.n })} value={lineAgg.orm} max={cmpMax} color={C.teal} unit={t("player.session.kg")} />
                : <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{t("player.session.cmpLine")} — {t("player.session.cmpKanon")}</div>}
              {teamAgg
                ? <CmpBar label={t("player.session.cmpTeam")} sub={t("player.session.cmpPlayers", { count: teamAgg.n })} value={teamAgg.orm} max={cmpMax} color={C.viol} unit={t("player.session.kg")} />
                : <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t("player.session.cmpTeam")} — {t("player.session.cmpKanon")}</div>}
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{t("player.session.cmpBasis")}</div>
            </>
          ) : (me?.orm || 0) > 0 ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{t("player.session.cmpKanonFull")}</div>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("player.session.cmpNoData")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
