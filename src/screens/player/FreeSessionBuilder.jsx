import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { SESSION_CODES, CODES, sessionCodeLabel } from "../../lib/tokens.js";
import { Overlay, Section, Tag } from "../../lib/ui.jsx";
import { Search, Plus, Check, Trash2, Dumbbell } from "../../lib/icons.jsx";
import { useExerciseLibrary, useExerciseFacets, bodyPartLabel, PAGE_SIZE } from "../../data/exerciseLibrary.js";
import { createFreeSession } from "../../data/freeSessions.js";
import { useMyRoutines, saveMyRoutine, deleteMyRoutine } from "../../data/routines.js";

const accent = C.green;

/* Compositeur de « séance libre » (autonome). Le joueur pioche des exercices
   dans la Bibliothèque (panier), règle séries/reps/charge, puis crée la séance
   (datée du jour, assignée à lui seul). Elle se loggue ensuite comme n'importe
   quelle séance (SessionPlayCard) et alimente historique / compliance / points.
   Le panier peut être chargé depuis une routine perso ou y être enregistré. */
export default function FreeSessionBuilder({ me, onClose, onCreated }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("RS");
  const [cart, setCart] = useState([]); // [{ ref, name, bodyPart, sets, reps, charge }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const { routines } = useMyRoutines(me?.id);

  const inCart = (ref) => cart.some((c) => c.ref === ref);
  const toggle = (ex) => {
    setCart((c) => inCart(ex.ref)
      ? c.filter((x) => x.ref !== ex.ref)
      : [...c, { ref: ex.ref, name: ex.name, bodyPart: ex.bodyPart, sets: 3, reps: "8", charge: "" }]);
  };
  const patch = (ref, p) => setCart((c) => c.map((x) => (x.ref === ref ? { ...x, ...p } : x)));
  const remove = (ref) => setCart((c) => c.filter((x) => x.ref !== ref));

  // Charge une routine perso dans le panier (remplace le contenu courant).
  const loadRoutine = (r) => {
    setCart((r.templates || []).map((tpl) => ({
      ref: tpl.ref || tpl.id || tpl.name,
      name: tpl.name,
      bodyPart: tpl.bodyPart,
      sets: tpl.sets ?? 3,
      reps: tpl.reps ?? "8",
      charge: tpl.charge ?? "",
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

  const create = async () => {
    if (cart.length === 0) return;
    setBusy(true); setErr("");
    try {
      const id = await createFreeSession({ title, code, exercises: cart });
      onCreated && onCreated(id);
      onClose();
    } catch (e) {
      setErr(e.message === "NO_EXERCISE" ? t("player.freeSession.errNoExercise") : t("common.actionFailed", { err: e.message }));
      setBusy(false);
    }
  };

  const inp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };

  return (
    <Overlay onClose={onClose} sheet>
      <div style={{ padding: "6px 18px 24px" }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{t("player.freeSession.title")}</div>

        {/* Réglages de la séance */}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("player.freeSession.namePlaceholder")} style={{ ...inp, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
          {SESSION_CODES.map((cd) => (
            <button key={cd} onClick={() => setCode(cd)} title={sessionCodeLabel(t, cd)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 7, border: code === cd ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent", fontSize: 11, fontWeight: 800, cursor: "pointer", background: code === cd ? (CODES[cd] || accent) : "rgba(255,255,255,0.07)", color: "#fff" }}>{cd}</button>
          ))}
        </div>

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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <LabeledNum label={t("player.freeSession.sets")} value={c.sets} onChange={(v) => patch(c.ref, { sets: v })} />
                  <LabeledTxt label={t("player.freeSession.reps")} value={c.reps} onChange={(v) => patch(c.ref, { reps: v })} placeholder="8" />
                  <LabeledTxt label={t("player.freeSession.charge")} value={c.charge} onChange={(v) => patch(c.ref, { charge: v })} placeholder="kg" />{/* i18n-ok: unité kg */}
                </div>
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

        {/* Ajout depuis la Bibliothèque */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, margin: "4px 0 10px" }}>{t("player.freeSession.addTitle")}</div>
        <ExercisePicker inCart={inCart} onToggle={toggle} />

        {err && <div style={{ fontSize: 11, color: C.coral, margin: "12px 0 0" }}>{err}</div>}

        <button onClick={create} disabled={busy || cart.length === 0} style={{ width: "100%", marginTop: 16, background: cart.length ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontWeight: 800, fontSize: 13, cursor: cart.length ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}>
          {busy ? t("player.freeSession.creating") : t("player.freeSession.create", { count: cart.length })}
        </button>
      </div>
    </Overlay>
  );
}

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

/* Recherche + filtre partie du corps + grille avec ajout rapide (quick-add). */
function ExercisePicker({ inCart, onToggle }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [page, setPage] = useState(0);
  const facets = useExerciseFacets();
  const { exercises, total, loading } = useExerciseLibrary({ search, bodyPart, page });
  const set = (fn) => (v) => { fn(v); setPage(0); };

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input value={search} onChange={(e) => set(setSearch)(e.target.value)} placeholder={t("shared.exlib.search")} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px 9px 32px", color: "#fff", fontSize: 12.5, outline: "none" }} />
      </div>
      <select value={bodyPart} onChange={(e) => set(setBodyPart)(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", marginBottom: 10 }}>
        <option value="">{t("shared.exlib.allBodyParts")}</option>
        {facets.bodyParts.map((v) => <option key={v} value={v}>{bodyPartLabel(t, v)}</option>)}
      </select>

      {loading ? (
        <div style={{ textAlign: "center", padding: 18, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{t("common.loading")}</div>
      ) : exercises.length === 0 ? (
        <div style={{ textAlign: "center", padding: 18, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{t("shared.exlib.empty")}</div>
      ) : (
        exercises.map((e) => {
          const on = inCart(e.ref);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Dumbbell size={16} color="rgba(255,255,255,0.3)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{e.name}</div>
                <div><Tag c={accent}>{bodyPartLabel(t, e.bodyPart)}</Tag></div>
              </div>
              <button onClick={() => onToggle(e)} title={on ? t("player.freeSession.added") : t("player.freeSession.add")} style={{ width: 34, height: 34, borderRadius: 8, border: on ? "none" : `1px solid ${accent}66`, background: on ? accent : `${accent}18`, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {on ? <Check size={16} /> : <Plus size={16} color={accent} />}
              </button>
            </div>
          );
        })
      )}
      {!loading && total > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ ...sc({ padding: "6px 12px" }), border: `1px solid ${C.border}`, color: "#fff", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.35 : 1, fontSize: 12 }}>{t("shared.exlib.prevPage")}</button>
          <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} style={{ ...sc({ padding: "6px 12px" }), border: `1px solid ${C.border}`, color: "#fff", cursor: (page + 1) * PAGE_SIZE >= total ? "default" : "pointer", opacity: (page + 1) * PAGE_SIZE >= total ? 0.35 : 1, fontSize: 12 }}>{t("shared.exlib.nextPage")}</button>
        </div>
      )}
    </div>
  );
}
