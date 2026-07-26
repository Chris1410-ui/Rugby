import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../lib/tokens.js";
import { CloseX, useModalClose } from "../../lib/ui.jsx";
import { X, Plus, CheckCircle } from "../../lib/icons.jsx";
import { buildAssigned } from "../../data/sessions.js";
import { request1RM } from "../../data/player1rm.js";
import RecipientSelect from "./RecipientSelect.jsx";
import ExerciseAutocomplete from "./ExerciseAutocomplete.jsx";

/* « Demander un 1RM » (staff) : destinataires (RecipientSelect) + un ou plusieurs
   exercices (ExerciseAutocomplete → lie exercise_id, ou nom libre). À l'envoi,
   crée les entrées « à renseigner » sur les fiches des joueurs et les notifie
   (RPC request_1rm). Réutilisable : préremplissable via initialSelection /
   initialExercises (ex. exercices détectés dans un message). */
export default function Request1RMModal({ players = [], accent = C.teal, initialSelection, initialExercises = [], onClose, onDone }) {
  const { t } = useTranslation();
  useModalClose(onClose);
  const [sel, setSel] = useState(initialSelection || { all: true, groups: [], ids: [] });
  const [exos, setExos] = useState(() => dedup(initialExercises));
  const [name, setName] = useState("");
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  const addExo = () => {
    const nm = (pick?.name || name).trim();
    if (!nm) return;
    setExos((xs) => dedup([...xs, { id: pick?.id || null, name: nm }]));
    setName(""); setPick(null);
  };
  const removeExo = (i) => setExos((xs) => xs.filter((_, k) => k !== i));

  const submit = async () => {
    if (busy || !exos.length) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await request1RM(buildAssigned(sel), exos);
      setRes(r);
      onDone?.(r);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  const inp = { background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 320, display: "flex", alignItems: "center", padding: "16px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, margin: "0 auto", background: C.panel, borderRadius: 18, padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🏋️ {t("request1rm.title")}</div>
          <CloseX onClose={onClose} />
        </div>

        {res ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.green, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
              <CheckCircle size={18} /> {t("request1rm.doneCreated", { count: res.created })}
            </div>
            {res.skipped > 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>{t("request1rm.doneSkipped", { count: res.skipped })}</div>}
            {res.unresolved?.length > 0 && (
              <div style={{ fontSize: 12, color: C.amb, marginBottom: 10 }}>{t("request1rm.doneUnresolved", { names: res.unresolved.join(", ") })}</div>
            )}
            <button onClick={onClose} style={{ width: "100%", background: accent, border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("common.close")}</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginBottom: 12, lineHeight: 1.5 }}>{t("request1rm.hint")}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, marginBottom: 8 }}>{t("request1rm.recipients")}</div>
            <RecipientSelect players={players} value={sel} onChange={setSel} accent={accent} />

            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, margin: "14px 0 8px" }}>{t("request1rm.exercises")}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <ExerciseAutocomplete
                value={name}
                onChange={(v) => setName(v)}
                onPick={(it) => setPick(it)}
                placeholder={t("request1rm.exPlaceholder")}
                style={inp}
              />
              <button onClick={addExo} disabled={!(pick?.name || name).trim()} title={t("request1rm.add")} style={{ background: accent, border: "none", borderRadius: 8, padding: "0 14px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, opacity: (pick?.name || name).trim() ? 1 : 0.5 }}>
                <Plus size={16} />
              </button>
            </div>
            {exos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {exos.map((e, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#fff", background: e.id ? `${accent}22` : "rgba(255,255,255,0.08)", border: `1px solid ${e.id ? accent : C.border}55`, borderRadius: 999, padding: "5px 10px" }}>
                    {e.name}{!e.id && <span style={{ fontSize: 8.5, color: C.amb }}>{t("request1rm.freeName")}</span>}
                    <button onClick={() => removeExo(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", padding: 0 }}><X size={13} /></button>
                  </span>
                ))}
              </div>
            )}

            {err && <div style={{ fontSize: 12, color: C.coral, marginBottom: 8 }}>{err}</div>}
            <button onClick={submit} disabled={busy || !exos.length} style={{ width: "100%", background: exos.length ? accent : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: 14, color: "#fff", fontWeight: 800, fontSize: 14, cursor: exos.length ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}>
              {busy ? "…" : t("request1rm.submit")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Déduplique par exercise_id si présent, sinon par nom normalisé simple.
function dedup(list) {
  const seen = new Set();
  const out = [];
  for (const e of list || []) {
    const nm = String(e?.name || "").trim();
    if (!nm) continue;
    const k = e.id ? `id:${e.id}` : `n:${nm.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: e.id || null, name: nm });
  }
  return out;
}
