import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { todayISO, fmtShort } from "../../lib/metrics.js";
import { Section } from "../../lib/ui.jsx";
import { Sun, CheckCircle, Plus, X, Pencil } from "../../lib/icons.jsx";
import { shakeProtein, routineComplete } from "../../lib/morningRoutine.js";
import { useRoutineConfig, saveRoutineConfig, useRoutineLog, saveRoutineLog, useRoutineHistory } from "../../data/morningRoutine.js";

const uid = (p) => `${p}${Math.random().toString(36).slice(2, 8)}`;

/* « Ma routine du matin » (staff-athlète uniquement). Checklist éditable + shake
   (quantités du jour + total protéines) ; routine complétée = +10 (aligné sur les
   activités du jour). Reset minuit local (filtre par date). Les joueurs ne voient
   que l'état ✓/✗, jamais le contenu (RLS self + RPC public dates seules). */
export default function MorningRoutine({ me, accent = C.green }) {
  const { t } = useTranslation();
  const today = todayISO();
  const { config, refresh: refreshCfg } = useRoutineConfig(me?.id, me?.team);
  const { log, refresh } = useRoutineLog(me?.id, today);
  const { rows: hist } = useRoutineHistory(me?.id, 30);

  const [items, setItems] = useState([]);   // config checklist (éditable)
  const [shake, setShake] = useState([]);   // shake DU JOUR (quantités)
  const [checked, setChecked] = useState([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => { if (config) setItems(config.items || []); }, [config]);
  useEffect(() => {
    if (!config) return;
    setShake((log?.shake?.length ? log.shake : config.shake) || []);
    setChecked(log?.checked || []);
  }, [config, log]);

  const protein = useMemo(() => shakeProtein(shake), [shake]);
  const complete = routineComplete(checked, items);
  const weekDone = hist.filter((r) => r.done).length;

  const toggle = (id) => { setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); setNote(""); };
  const setQty = (id, v) => setShake((s) => s.map((x) => (x.id === id ? { ...x, qty: v === "" ? "" : Number(v) } : x)));

  const save = async () => {
    if (!me?.id) return;
    setBusy(true); setNote("");
    try {
      const cleanShake = shake.map((x) => ({ ...x, qty: Number(x.qty) || 0 }));
      await saveRoutineLog(me.id, me.team, today, { checked, shake: cleanShake, proteinG: shakeProtein(cleanShake), done: routineComplete(checked, items) });
      setNote("ok"); refresh();
    } catch (e) { setNote(t("player.routine.errSave", { err: e.message || "" })); }
    setBusy(false);
  };

  // ── Édition de la config (items + shake) ──
  const saveCfg = async (nextItems, nextShake) => {
    try { await saveRoutineConfig(me.id, me.team, { items: nextItems, shake: nextShake }); refreshCfg(); }
    catch (e) { setNote(t("player.routine.errSave", { err: e.message || "" })); }
  };
  const addItem = () => { const n = [...items, { id: uid("it"), label: "", time: "" }]; setItems(n); saveCfg(n, config?.shake || shake); };
  const setItem = (id, patch) => { const n = items.map((x) => (x.id === id ? { ...x, ...patch } : x)); setItems(n); };
  const delItem = (id) => { const n = items.filter((x) => x.id !== id); setItems(n); setChecked((c) => c.filter((x) => x !== id)); saveCfg(n, config?.shake || shake); };
  const addIng = () => { const n = [...shake, { id: uid("sh"), label: "", qty: 0, unit: "", proteinPer: 0 }]; setShake(n); saveCfg(items, n); };
  const setIng = (id, patch) => setShake((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delIng = (id) => { const n = shake.filter((x) => x.id !== id); setShake(n); saveCfg(items, n); };
  const commitCfg = () => { saveCfg(items, shake.map((x) => ({ ...x, qty: Number(x.qty) || 0, proteinPer: Number(x.proteinPer) || 0 }))); setEditing(false); };

  const inp = { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 9px", color: "#fff", fontSize: 12.5, outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sun size={18} color={accent} />
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{t("player.routine.title")}</div>
        <button onClick={() => (editing ? commitCfg() : setEditing(true))} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          {editing ? <><CheckCircle size={13} /> {t("player.routine.doneEdit")}</> : <><Pencil size={12} /> {t("player.routine.edit")}</>}
        </button>
      </div>

      {/* État du jour */}
      <div style={sc({ marginBottom: 12, padding: 13, borderColor: complete ? `${C.green}66` : C.border })}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>{complete ? "✅" : "🌅"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: complete ? C.green : "#fff" }}>{complete ? t("player.routine.complete") : t("player.routine.inProgress")}</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{t("player.routine.checkedCount", { done: checked.length, total: items.length })}{complete ? t("player.routine.plus10") : ""}</div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <Section title={t("player.routine.checklist")}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
            {editing ? (
              <>
                <input value={it.label} onChange={(e) => setItem(it.id, { label: e.target.value })} placeholder={t("player.routine.itemPlaceholder")} style={{ ...inp, flex: 1 }} />
                <input value={it.time} onChange={(e) => setItem(it.id, { time: e.target.value })} placeholder={t("player.routine.timePlaceholder")} style={{ ...inp, width: 90 }} />
                <button onClick={() => delItem(it.id)} style={{ background: "none", border: "none", color: C.coral, cursor: "pointer", padding: 4 }}><X size={15} /></button>
              </>
            ) : (
              <div onClick={() => toggle(it.id)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked.includes(it.id) ? accent : C.border}`, background: checked.includes(it.id) ? accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{checked.includes(it.id) && <CheckCircle size={13} color="#fff" />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, textDecoration: checked.includes(it.id) ? "line-through" : "none", opacity: checked.includes(it.id) ? 0.6 : 1 }}>{it.label}</div>
                  {it.time && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{it.time}</div>}
                </div>
              </div>
            )}
          </div>
        ))}
        {editing && <button onClick={addItem} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 8, padding: 8, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={13} /> {t("player.routine.addItem")}</button>}
      </Section>

      {/* Shake */}
      <Section title={t("player.routine.shake")} right={<span style={{ fontSize: 12, fontWeight: 800, color: accent }}>{t("player.routine.protein", { g: protein })}</span>}>
        {shake.map((ing) => (
          <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border2}` }}>
            {editing ? (
              <>
                <input value={ing.label} onChange={(e) => setIng(ing.id, { label: e.target.value })} placeholder={t("player.routine.ingPlaceholder")} style={{ ...inp, flex: 1 }} />
                <input value={ing.unit} onChange={(e) => setIng(ing.id, { unit: e.target.value })} placeholder={t("player.routine.unit")} style={{ ...inp, width: 54, textAlign: "center" }} />
                <input type="number" value={ing.proteinPer} onChange={(e) => setIng(ing.id, { proteinPer: e.target.value })} title={t("player.routine.proteinPer")} style={{ ...inp, width: 60, textAlign: "center" }} />
                <button onClick={() => delIng(ing.id)} style={{ background: "none", border: "none", color: C.coral, cursor: "pointer", padding: 4 }}><X size={15} /></button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{ing.label}</div>
                <input type="number" value={ing.qty} onChange={(e) => setQty(ing.id, e.target.value)} style={{ ...inp, width: 66, textAlign: "right" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", width: 34 }}>{ing.unit}</span>
              </>
            )}
          </div>
        ))}
        {editing && <button onClick={addIng} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px dashed ${C.border}`, borderRadius: 8, padding: 8, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={13} /> {t("player.routine.addIng")}</button>}
      </Section>

      {!editing && (
        <>
          {note && note !== "ok" && <div style={{ fontSize: 12, color: C.coral, marginBottom: 8 }}>{note}</div>}
          {note === "ok" && <div style={{ fontSize: 12, color: C.green, marginBottom: 8 }}>{t("player.routine.saved")}</div>}
          <button onClick={save} disabled={busy} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: 14, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1, marginBottom: 14 }}>{busy ? "…" : t("player.routine.save")}</button>

          {hist.length > 0 && (
            <Section title={t("player.routine.trend")}>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>{t("player.routine.trendSummary", { done: weekDone, total: hist.length })}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {hist.slice(0, 10).map((r) => (
                  <div key={r.date} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
                    <span style={{ width: 14 }}>{r.done ? "✅" : "◦"}</span>
                    <span style={{ flex: 1, color: "rgba(255,255,255,0.7)" }}>{fmtShort(r.date)}</span>
                    {r.proteinG != null && <span style={{ color: accent, fontWeight: 700 }}>{t("player.routine.protein", { g: Math.round(r.proteinG) })}</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
