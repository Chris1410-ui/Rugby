import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { Section, Tag } from "../../lib/ui.jsx";
import { Plus, TrendingUp } from "../../lib/icons.jsx";
import { fmtShort } from "../../lib/metrics.js";
import { usePlayer1RM, add1RM } from "../../data/player1rm.js";
import { summarize1RM } from "../../lib/oneRM.js";
import ExerciseAutocomplete from "./ExerciseAutocomplete.jsx";

/* Section « 1RM » de la fiche joueur : liste dynamique par mouvement (valeur
   courante, badge testé/estimé, date, historique), saisissable par le staff et
   par le joueur. Base du calcul de charge en % (PR2/PR3). */
export default function Player1RM({ player, self = false, canEdit = false }) {
  const { t } = useTranslation();
  const { entries } = usePlayer1RM(player?.id);
  const canAdd = self || canEdit;
  const [adding, setAdding] = useState(false);
  const [hist, setHist] = useState(null); // mouvement dont on voit l'historique

  const rows = useMemo(() => summarize1RM(entries), [entries]);

  return (
    <Section title={t("oneRM.title", { count: rows.length })} right={canAdd && !adding ? (
      <button onClick={() => setAdding(true)} style={{ background: "none", border: "none", color: C.viol, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Plus size={13} /> {t("oneRM.add")}</button>
    ) : null}>
      {adding && <AddForm player={player} self={self} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} t={t} />}

      {rows.length === 0 && !adding ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{t("oneRM.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => (
            <div key={r.identity} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                  {r.missing ? t("oneRM.notSet") : `${r.measuredAt ? fmtShort(r.measuredAt) : ""}${r.history.length > 1 ? ` · ${t("oneRM.histN", { count: r.history.length })}` : ""}`}
                </div>
              </div>
              {r.missing ? (
                <Tag c={C.amb}>{t("oneRM.toSet")}</Tag>
              ) : (
                <>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{r.value}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}> {t("oneRM.kg")}</span></span>
                  <Tag c={r.kind === "estime" ? C.amb : C.green}>{t(r.kind === "estime" ? "oneRM.estimated" : "oneRM.tested")}</Tag>
                  {r.history.length > 1 && <button onClick={() => setHist(r)} title={t("oneRM.history")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex" }}><TrendingUp size={14} /></button>}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {hist && <HistoryModal row={hist} onClose={() => setHist(null)} t={t} />}
    </Section>
  );
}

function AddForm({ player, self, onDone, onCancel, t }) {
  const [name, setName] = useState("");
  const [exerciseId, setExerciseId] = useState(null); // lié à la bibliothèque si choisi (dédup + agrégats)
  const [mode, setMode] = useState("direct"); // 'direct' (1RM) | 'submax' (poids × reps → estimé)
  const [value, setValue] = useState("");
  const [w, setW] = useState("");
  const [reps, setReps] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const inp = { width: "100%", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", colorScheme: "dark", boxSizing: "border-box" };

  const save = async () => {
    if (!name.trim()) return setErr(t("oneRM.errName"));
    if (mode === "direct" && !(Number(value) > 0)) return setErr(t("oneRM.errValue"));
    if (mode === "submax" && !(Number(w) > 0 && Number(reps) > 0)) return setErr(t("oneRM.errSubmax"));
    setBusy(true); setErr("");
    try {
      await add1RM(player.team, player.id, {
        name,
        exerciseId,
        valueKg: mode === "direct" ? value : null,
        testWeight: mode === "submax" ? w : null,
        testReps: mode === "submax" ? reps : null,
        measuredAt: date,
        source: self ? "player" : "staff",
      });
      onDone();
    } catch (e) { setErr(t("oneRM.errSave", { err: e.message || "" })); setBusy(false); }
  };

  const pill = (on) => ({ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: on ? C.viol : "rgba(255,255,255,0.07)", color: "#fff" });

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ marginBottom: 8 }}>
        <ExerciseAutocomplete
          value={name}
          onChange={(v) => { setName(v); setErr(""); }}
          onPick={(it) => setExerciseId(it?.id || null)}
          placeholder={t("oneRM.movementPh")}
          style={inp}
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setMode("direct")} style={pill(mode === "direct")}>{t("oneRM.modeDirect")}</button>
        <button onClick={() => setMode("submax")} style={pill(mode === "submax")}>{t("oneRM.modeSubmax")}</button>
      </div>
      {mode === "direct" ? (
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={t("oneRM.valuePh")} style={{ ...inp, marginBottom: 8 }} />
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
          <input value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" placeholder={t("oneRM.weightPh")} style={{ ...inp, flex: 1 }} />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>×</span>
          <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder={t("oneRM.repsPh")} style={{ ...inp, flex: 1 }} />
        </div>
      )}
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ flex: 1, background: C.viol, border: "none", borderRadius: 8, padding: 9, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("oneRM.save")}</button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "9px 14px", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

function HistoryModal({ row, onClose, t }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: C.panel, borderRadius: 16, padding: 18, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{row.label}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {row.history.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{h.measuredAt ? fmtShort(h.measuredAt) : "—"}</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{h.value} {t("oneRM.kg")}</span>
              <Tag c={h.kind === "estime" ? C.amb : C.green}>{t(h.kind === "estime" ? "oneRM.estimated" : "oneRM.tested")}</Tag>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
