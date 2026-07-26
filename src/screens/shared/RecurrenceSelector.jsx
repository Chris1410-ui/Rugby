import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { localeTag } from "../../i18n/locale.js";
import { todayISO } from "../../lib/metrics.js";
import { X, Plus } from "../../lib/icons.jsx";
import { expandRecurrence, summarizeDays, WEEKDAY_ORDER } from "../../lib/recurrence.js";

/* Sélecteur de récurrence PARTAGÉ (un seul composant, déployé sur tous les écrans
   de création). Mode Ponctuel (défaut, comportement actuel) ou Récurrent : 7
   pastilles L M M J V S D (multi), heure par jour, période, exclusions, et un
   récapitulatif live. Le parent lit `value` (voir lib/recurrence.js) et appelle
   expandRecurrence pour matérialiser les occurrences. `recipientCount` sert au
   récap ; il est calculé par l'écran hôte (réutilise le sélecteur de
   destinataires existant). */
export default function RecurrenceSelector({ value, onChange, recipientCount = 0, maxOccurrences = 200, accent = C.teal, allowRecurring = true }) {
  const { t } = useTranslation();
  const [excl, setExcl] = useState("");
  const v = value || { mode: "once", date: todayISO(), time: "", weekdays: [], times: {}, start: todayISO(), end: "", exclusions: [] };
  const patch = (p) => onChange({ ...v, ...p });

  // Libellé d'un jour ISO (1..7) dans la locale — pastille (narrow) ou récap (long).
  const dayLabel = (wd, style) => {
    const d = new Date(2024, 0, 1 + (wd - 1)); // 2024-01-01 = lundi
    const s = d.toLocaleDateString(localeTag(), { weekday: style });
    return style === "long" ? s.charAt(0).toUpperCase() + s.slice(1) : s.toUpperCase();
  };

  const toggleDay = (wd) => {
    const on = (v.weekdays || []).includes(wd);
    patch({ weekdays: on ? v.weekdays.filter((x) => x !== wd) : [...(v.weekdays || []), wd].sort((a, b) => a - b) });
  };
  const setTime = (wd, val) => patch({ times: { ...(v.times || {}), [wd]: val } });
  const addExcl = () => { if (excl && !(v.exclusions || []).includes(excl)) patch({ exclusions: [...(v.exclusions || []), excl].sort() }); setExcl(""); };
  const rmExcl = (dt) => patch({ exclusions: (v.exclusions || []).filter((x) => x !== dt) });

  const exp = expandRecurrence(v, maxOccurrences); // léger (borné à maxOccurrences)
  const longLabels = Object.fromEntries(WEEKDAY_ORDER.map((wd) => [wd, dayLabel(wd, "long")]));
  const recapDays = summarizeDays(v, longLabels);
  const fmt = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(localeTag(), { day: "2-digit", month: "2-digit" }) : "—");

  const inp = { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark" };
  const lbl = { fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.4, marginBottom: 4 };
  const modeBtn = (on) => ({ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${on ? accent : C.border}`, background: on ? `${accent}22` : "rgba(255,255,255,0.04)", color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: 800, cursor: "pointer" });

  return (
    <div>
      {allowRecurring && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button type="button" onClick={() => patch({ mode: "once" })} style={modeBtn(v.mode !== "recurring")}>{t("recurrence.once")}</button>
          <button type="button" onClick={() => patch({ mode: "recurring", start: v.start || todayISO() })} style={modeBtn(v.mode === "recurring")}>{t("recurrence.recurring")}</button>
        </div>
      )}

      {v.mode !== "recurring" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1.3 }}><div style={lbl}>{t("recurrence.date")}</div><input type="date" value={v.date || ""} onChange={(e) => patch({ date: e.target.value })} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
          <div style={{ flex: 1 }}><div style={lbl}>{t("recurrence.time")}</div><input type="time" value={v.time || ""} onChange={(e) => patch({ time: e.target.value })} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
        </div>
      ) : (
        <>
          <div style={lbl}>{t("recurrence.days")}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {WEEKDAY_ORDER.map((wd) => {
              const on = (v.weekdays || []).includes(wd);
              return (
                <button key={wd} type="button" onClick={() => toggleDay(wd)} title={longLabels[wd]} style={{ flex: 1, height: 42, borderRadius: 10, border: `2px solid ${on ? accent : C.border}`, background: on ? accent : "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{dayLabel(wd, "narrow")}</button>
              );
            })}
          </div>

          {(v.weekdays || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {[...v.weekdays].sort((a, b) => a - b).map((wd) => (
                <div key={wd} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{longLabels[wd]}</span>
                  <input type="time" value={(v.times || {})[wd] || ""} onChange={(e) => setTime(wd, e.target.value)} style={{ ...inp, width: 120 }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><div style={lbl}>{t("recurrence.from")}</div><input type="date" value={v.start || ""} onChange={(e) => patch({ start: e.target.value })} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
            <div style={{ flex: 1 }}><div style={lbl}>{t("recurrence.to")}</div><input type="date" value={v.end || ""} onChange={(e) => patch({ end: e.target.value })} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
          </div>

          <div style={lbl}>{t("recurrence.exclusions")}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input type="date" value={excl} onChange={(e) => setExcl(e.target.value)} style={{ ...inp, flex: 1 }} />
            <button type="button" onClick={addExcl} disabled={!excl} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "0 12px", color: "#fff", cursor: excl ? "pointer" : "default", opacity: excl ? 1 : 0.5, display: "flex", alignItems: "center" }}><Plus size={15} /></button>
          </div>
          {(v.exclusions || []).length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {v.exclusions.map((dt) => (
                <span key={dt} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 6px 3px 9px", fontSize: 11 }}>
                  {fmt(dt)}<button type="button" onClick={() => rmExcl(dt)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", padding: 0 }}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Récapitulatif live avant validation */}
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", background: `${accent}12`, border: `1px solid ${accent}44`, borderRadius: 10, padding: "9px 11px", lineHeight: 1.5 }}>
            {exp.count > 0 ? (
              <>
                <span style={{ fontWeight: 800 }}>{recapDays || t("recurrence.pickDays")}</span>
                {v.start && v.end ? <> · {t("recurrence.period", { from: fmt(v.start), to: fmt(v.end) })}</> : null}
                {" · "}<span style={{ fontWeight: 800, color: accent }}>{t("recurrence.occCount", { count: exp.count })}</span>
                {" · "}{t("recurrence.recipCount", { count: recipientCount })}
                {exp.capped && <div style={{ color: C.amb, marginTop: 3 }}>⚠ {t("recurrence.capped", { max: maxOccurrences })}</div>}
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.55)" }}>{t("recurrence.incomplete")}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
