import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { SESSION_CODES, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { Overlay, Section } from "../../lib/ui.jsx";
import { Plus, Trash2 } from "../../lib/icons.jsx";
import { createFreeSession } from "../../data/freeSessions.js";
import { useMyRoutines, saveMyRoutine, deleteMyRoutine } from "../../data/routines.js";
import {
  SESSION_TYPES, SESSION_TYPE_ICON, sessionTypeLabel,
  natureForType, codeForType, libraryFilterForType,
} from "../../lib/sessionType.js";
import ExercisePickerSheet from "../shared/ExercisePickerSheet.jsx";
import ExerciseAutocomplete from "../shared/ExerciseAutocomplete.jsx";
import ConditioningBuilder from "./ConditioningBuilder.jsx";

const accent = C.green;

// Types réellement saisissables. Conditioning/Mixte arrivent en PR3b-2 (builder à
// blocs + rendu de log ensemble) → affichés « Bientôt », non sélectionnables.
const ENABLED_TYPES = ["strength", "bodyweight", "skills"];

/* Compositeur de « séance libre ». Étape 0 : choix du TYPE (modèle de saisie).
   Puis panier adapté au type (la muscu garde séries/reps/charge ; le poids de
   corps masque le kg avec une option lest). La séance créée porte son
   session_type + nature ; elle se loggue comme n'importe quelle séance. */
export default function FreeSessionBuilder({ me, onClose, onCreated }) {
  const { t } = useTranslation();
  const [type, setType] = useState(null); // null → écran de choix du type
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("RS");
  const [durationMin, setDurationMin] = useState(60);
  const [advanced, setAdvanced] = useState(false);
  const [cart, setCart] = useState([]); // [{ ref, name, bodyPart, sets, reps, charge?, lest?, lestOn? }]
  const [blocks, setBlocks] = useState([]); // conditioning : liste de blocs typés
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [picking, setPicking] = useState(false);
  const [quick, setQuick] = useState("");
  const { routines } = useMyRoutines(me?.id);

  const isBW = type === "bodyweight";
  const isSkill = type === "skills";
  const isCond = type === "conditioning"; // builder « liste de blocs » (gated jusqu'à PR3b-2)
  const filter = type ? libraryFilterForType(type) : null;

  const chooseType = (ty) => { setType(ty); setCode(codeForType(ty)); };

  const inCart = (ref) => cart.some((c) => c.ref === ref);
  const newLine = (ref, name, bodyPart) => ({ ref, name, bodyPart: bodyPart || "", sets: 3, reps: "8", charge: "", lest: "", lestOn: false, measure: "reps", hold: "" });

  const quickAdd = (name, id, bodyPart) => {
    const nm = (name || "").trim();
    if (!nm) return;
    const ref = id || `q:${nm.toLowerCase()}`;
    setCart((c) => (c.some((x) => x.ref === ref) ? c : [...c, newLine(ref, nm, bodyPart)]));
    setQuick("");
  };
  const patch = (ref, p) => setCart((c) => c.map((x) => (x.ref === ref ? { ...x, ...p } : x)));
  const remove = (ref) => setCart((c) => c.filter((x) => x.ref !== ref));

  const addFromLibrary = (items) => {
    setCart((c) => {
      const have = new Set(c.map((x) => x.ref));
      const fresh = items.filter((e) => !have.has(e.ref)).map((e) => newLine(e.ref, e.name, e.bodyPart));
      return [...c, ...fresh];
    });
  };

  const loadRoutine = (r) => {
    setCart((r.templates || []).map((tpl) => ({
      ref: tpl.ref || tpl.id || tpl.name,
      name: tpl.name,
      bodyPart: tpl.bodyPart,
      sets: tpl.sets ?? 3,
      reps: tpl.reps ?? "8",
      charge: tpl.charge ?? "",
      lest: tpl.charge ?? "",
      lestOn: isBW && !!tpl.charge,
    })));
    if (!title && r.name) setTitle(r.name);
  };

  const saveRoutine = async () => {
    if (cart.length === 0) return;
    setBusy(true); setErr("");
    try {
      await saveMyRoutine(me?.id, me?.team, { name: routineName || title, templates: cart });
      setSavingRoutine(false); setRoutineName("");
    } catch (e) {
      setErr(t("common.actionFailed", { err: e.message }));
    }
    setBusy(false);
  };

  const removeRoutine = async (r) => {
    try { await deleteMyRoutine(r.id); } catch (e) { console.error("[deleteMyRoutine]", e.message); }
  };

  // Mappe une ligne panier → item bloc selon le type (kind + champs propres).
  const toBlock = (c) => {
    if (isBW) return { ref: c.ref, name: c.name, kind: "bodyweight", sets: c.sets, reps: c.reps, lest: c.lestOn ? c.lest : "" };
    if (isSkill) return { ref: c.ref, name: c.name, kind: "skill", sets: c.sets, measure: c.measure, reps: c.measure === "reps" ? c.reps : undefined, holdSec: c.measure === "temps" ? c.hold : undefined };
    return { ref: c.ref, name: c.name, kind: "strength", sets: c.sets, reps: c.reps, charge: c.charge };
  };

  const items = isCond ? blocks : cart;
  const create = async () => {
    if (items.length === 0) return;
    setBusy(true); setErr("");
    try {
      const id = await createFreeSession({
        title, code, type, nature: natureForType(type),
        durationMin, exercises: isCond ? blocks : cart.map(toBlock),
      });
      onCreated && onCreated(id);
      onClose();
    } catch (e) {
      setErr(e.message === "NO_EXERCISE" ? t("player.freeSession.errNoExercise") : t("common.actionFailed", { err: e.message }));
      setBusy(false);
    }
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };

  // ── Étape 0 : choix du type ────────────────────────────────────────────────
  if (!type) {
    return (
      <Overlay onClose={onClose} sheet>
        <div style={{ padding: "6px 18px 24px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{t("player.freeSession.title")}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>{t("player.freeSession.chooseType")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SESSION_TYPES.map((ty) => {
              const on = ENABLED_TYPES.includes(ty);
              return (
                <button
                  key={ty}
                  onClick={() => on && chooseType(ty)}
                  disabled={!on}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
                    background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: "13px 14px", color: "#fff", cursor: on ? "pointer" : "default", opacity: on ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{SESSION_TYPE_ICON[ty]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{sessionTypeLabel(t, ty)}</span>
                    <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>{t(`player.freeSession.typeDesc.${ty}`)}</span>
                  </span>
                  {!on && <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: C.amb, background: `${C.amb}22`, border: `1px solid ${C.amb}55`, borderRadius: 6, padding: "3px 7px" }}>{t("player.freeSession.soon")}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </Overlay>
    );
  }

  // ── Builder (type choisi) ──────────────────────────────────────────────────
  return (
    <Overlay onClose={onClose} sheet>
      <div style={{ padding: "6px 18px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 20 }}>{SESSION_TYPE_ICON[type]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{sessionTypeLabel(t, type)}</div>
          </div>
          <button onClick={() => { setType(null); setCart([]); }} style={{ background: "none", border: "none", color: accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{t("player.freeSession.changeType")}</button>
        </div>

        {/* Réglages de la séance */}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("player.freeSession.namePlaceholder")} style={{ ...inp, marginBottom: 8 }} />

        {/* Durée totale prévue (min) → pré-remplit le sRPE au log */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", flex: 1 }}>{t("player.freeSession.duration")}</span>
          <button onClick={() => setDurationMin((v) => Math.max(5, (Number(v) || 60) - 5))} style={stepBtn}>−5</button>
          <input value={durationMin} onChange={(e) => setDurationMin(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" style={{ width: 62, textAlign: "center", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 6px", color: "#fff", fontSize: 14, fontWeight: 800, outline: "none" }} />
          <button onClick={() => setDurationMin((v) => Math.min(300, (Number(v) || 60) + 5))} style={stepBtn}>+5</button>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{t("player.session.min")}</span>
        </div>

        {/* Réglages avancés : pastille (code) */}
        <button onClick={() => setAdvanced((v) => !v)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "2px 0", marginBottom: advanced ? 8 : 14 }}>
          {advanced ? "▾" : "▸"} {t("player.freeSession.advanced")}
        </button>
        {advanced && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
            {SESSION_CODES.map((cd) => (
              <button key={cd} onClick={() => setCode(cd)} title={sessionCodeLabel(t, cd)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 7, border: code === cd ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent", fontSize: 11, fontWeight: 800, cursor: "pointer", background: code === cd ? (CODES[cd] || accent) : "rgba(255,255,255,0.07)", color: "#fff" }}>{cd}</button>
            ))}
          </div>
        )}

        {isCond ? (
          <ConditioningBuilder blocks={blocks} setBlocks={setBlocks} masKmh={me?.mas} t={t} accent={accent} />
        ) : (<>
        {/* Mes routines : chargement en un geste */}
        {routines.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, marginBottom: 8 }}>{t("player.freeSession.myRoutines")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {routines.map((r) => (
                <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px 5px 10px" }}>
                  <button onClick={() => loadRoutine(r)} title={t("player.freeSession.loadRoutine")} style={{ background: "none", border: "none", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    {r.name} <span style={{ color: "rgba(255,255,255,0.45)" }}>· {r.templates?.length || 0}</span>
                  </button>
                  <button onClick={() => removeRoutine(r)} title={t("player.freeSession.deleteRoutine")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", padding: 0 }}><Trash2 size={13} /></button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Panier */}
        <Section title={t("player.freeSession.cartTitle")} right={<span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{cart.length}</span>}>
          {cart.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "6px 0" }}>{t("player.freeSession.cartEmpty")}</div>
          ) : (
            cart.map((c) => (
              <div key={c.ref} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700 }}>{c.name}</span>
                  <button onClick={() => remove(c.ref)} title={t("player.freeSession.remove")} style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, display: "flex" }}><Trash2 size={15} /></button>
                </div>
                {isSkill ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 6, alignItems: "end" }}>
                    <LabeledNum label={t("player.freeSession.sets")} value={c.sets} onChange={(v) => patch(c.ref, { sets: v })} />
                    <label style={{ display: "block" }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{t("player.freeSession.measure")}</span>
                      <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                        {["reps", "temps"].map((m) => (
                          <button key={m} onClick={() => patch(c.ref, { measure: m })} style={{ flex: 1, padding: "6px 4px", borderRadius: 6, border: c.measure === m ? `1px solid ${accent}` : `1px solid ${C.border}`, background: c.measure === m ? `${accent}22` : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{t(`player.freeSession.measure_${m}`)}</button>
                        ))}
                      </div>
                    </label>
                    {c.measure === "temps"
                      ? <LabeledTxt label={t("player.freeSession.hold")} value={c.hold} onChange={(v) => patch(c.ref, { hold: v })} placeholder="30" />
                      : <LabeledTxt label={t("player.freeSession.reps")} value={c.reps} onChange={(v) => patch(c.ref, { reps: v })} placeholder="8" />}
                  </div>
                ) : isBW ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: c.lestOn ? "1fr 1fr 1fr" : "1fr 1fr", gap: 6 }}>
                      <LabeledNum label={t("player.freeSession.sets")} value={c.sets} onChange={(v) => patch(c.ref, { sets: v })} />
                      <LabeledTxt label={t("player.freeSession.reps")} value={c.reps} onChange={(v) => patch(c.ref, { reps: v })} placeholder="8" />
                      {c.lestOn && <LabeledTxt label={t("player.freeSession.lest")} value={c.lest} onChange={(v) => patch(c.ref, { lest: v })} placeholder="kg" />}{/* i18n-ok: unité kg */}
                    </div>
                    <button onClick={() => patch(c.ref, { lestOn: !c.lestOn })} style={{ background: "none", border: "none", color: accent, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: "5px 0 0" }}>
                      {c.lestOn ? t("player.freeSession.removeLest") : `+ ${t("player.freeSession.lest")}`}
                    </button>
                  </>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    <LabeledNum label={t("player.freeSession.sets")} value={c.sets} onChange={(v) => patch(c.ref, { sets: v })} />
                    <LabeledTxt label={t("player.freeSession.reps")} value={c.reps} onChange={(v) => patch(c.ref, { reps: v })} placeholder="8" />
                    <LabeledTxt label={t("player.freeSession.charge")} value={c.charge} onChange={(v) => patch(c.ref, { charge: v })} placeholder="kg" />{/* i18n-ok: unité kg */}
                  </div>
                )}
              </div>
            ))
          )}
        </Section>

        {/* Enregistrer le panier comme routine perso réutilisable */}
        {cart.length > 0 && (
          savingRoutine ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder={t("player.freeSession.routineNamePlaceholder")} autoFocus style={{ ...inp, flex: 1 }} />
              <button onClick={saveRoutine} disabled={busy} style={{ background: accent, border: "none", borderRadius: 8, padding: "0 14px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{t("player.freeSession.saveRoutineConfirm")}</button>
              <button onClick={() => setSavingRoutine(false)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 12px", color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
            </div>
          ) : (
            <button onClick={() => { setSavingRoutine(true); setRoutineName(title); }} style={{ background: "none", border: "none", color: accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "2px 0", display: "flex", alignItems: "center", gap: 5 }}>
              <Plus size={13} /> {t("player.freeSession.saveAsRoutine")}
            </button>
          )
        )}

        {/* Ajout rapide par nom (autocomplétion, filtrée par type) */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "stretch" }}>
          <ExerciseAutocomplete
            value={quick}
            onChange={setQuick}
            onPick={(it) => it && quickAdd(it.name, it.id, it.category)}
            placeholder={t("player.freeSession.quickAddPh")}
            style={inp}
            filter={filter}
          />
          <button onClick={() => quickAdd(quick)} disabled={!quick.trim()} title={t("player.freeSession.quickAdd")} style={{ flexShrink: 0, background: accent, border: "none", borderRadius: 8, padding: "0 14px", color: "#fff", cursor: quick.trim() ? "pointer" : "default", opacity: quick.trim() ? 1 : 0.5, display: "flex", alignItems: "center" }}><Plus size={16} /></button>
        </div>

        {/* Ajout depuis la Bibliothèque (sélecteur partagé, filtré par type) */}
        <button onClick={() => setPicking(true)} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 12, color: accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Plus size={15} /> {t("shared.expick.title")}
        </button>
        </>)}

        {err && <div style={{ fontSize: 11, color: C.coral, margin: "12px 0 0" }}>{err}</div>}

        <button onClick={create} disabled={busy || items.length === 0} style={{ width: "100%", marginTop: 16, background: items.length ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 13, cursor: items.length ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}>
          {busy ? t("player.freeSession.creating") : t("player.freeSession.create", { count: items.length })}
        </button>
      </div>

      {picking && <ExercisePickerSheet onAdd={addFromLibrary} onClose={() => setPicking(false)} isAdded={(e) => inCart(e.ref)} filter={filter} />}
    </Overlay>
  );
}

const stepBtn = { flexShrink: 0, width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" };

function LabeledNum({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" style={miniInp} />
    </label>
  );
}
function LabeledTxt({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={miniInp} />
    </label>
  );
}
const miniInp = { width: "100%", marginTop: 3, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" };
