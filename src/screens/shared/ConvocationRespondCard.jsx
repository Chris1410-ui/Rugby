import { useState } from "react";
import { useTranslation } from "react-i18next";
import { localeTag } from "../../i18n/locale.js";
import { C, sc } from "../../lib/tokens.js";
import { parseISO } from "../../lib/metrics.js";
import { NatureTag } from "../../lib/ui.jsx";
import { respondTraining } from "../../data/trainings.js";

const STATE_COLOR = { present: C.green, late: C.amb, absent: C.coral };

/* Carte de convocation côté joueur : consigne (date/heure/lieu/nature) + réponse
   présent / absent (motif optionnel) / en retard (heure d'arrivée optionnelle).
   Le joueur répond via le RPC training_respond (aucune écriture directe). En
   aperçu owner/staff → lecture seule. */
export default function ConvocationRespondCard({ tr, mine, accent = C.coral, readOnly = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // 'absent'|'late' en cours de précision
  const [reason, setReason] = useState(mine?.absenceReason || "");
  const [eta, setEta] = useState(mine?.eta || "");
  const resp = mine?.playerResponse || null;

  const send = async (status, r = null, e = null) => {
    if (readOnly) return;
    setBusy(true);
    try { await respondTraining(tr.id, status, r, e); }
    catch (err) { console.error("[convocation]", err.message); }
    setBusy(false);
  };
  const choose = (status) => {
    if (status === "absent") { setPending(pending === "absent" ? null : "absent"); send("absent", reason || null); }
    else if (status === "late") { setPending(pending === "late" ? null : "late"); send("late", null, eta || null); }
    else { setPending(null); send("present"); }
  };

  const d = parseISO(tr.date);
  const btn = (status, label) => {
    const on = resp === status;
    return (
      <button onClick={() => choose(status)} disabled={busy || readOnly} style={{
        flex: 1, padding: "9px 6px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: readOnly ? "default" : "pointer",
        background: on ? STATE_COLOR[status] : "rgba(255,255,255,0.06)", color: on ? "#fff" : "rgba(255,255,255,0.7)",
        border: `1px solid ${on ? STATE_COLOR[status] : C.border}`, opacity: busy ? 0.6 : 1,
      }}>{label}</button>
    );
  };

  return (
    <div style={sc({ padding: 14, borderLeft: `3px solid ${resp ? STATE_COLOR[resp] : accent}` })}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ textAlign: "center", width: 42, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{d.toLocaleDateString(localeTag(), { month: "short" })}</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{d.getDate()}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {tr.nature && <NatureTag nature={tr.nature} />}
            <span style={{ fontSize: 14, fontWeight: 800 }}>{tr.titre || t("staff.convocations.untitled")}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
            {[tr.heure, tr.lieu].filter(Boolean).join(" · ") || t("player.convocations.noTimePlace")}
          </div>
        </div>
      </div>

      {tr.notes && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginBottom: 8, lineHeight: 1.5 }}>{tr.notes}</div>}

      {readOnly ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t("common.previewReadonly")}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6 }}>
            {btn("present", t("player.convocations.present"))}
            {btn("late", t("player.convocations.late"))}
            {btn("absent", t("player.convocations.absent"))}
          </div>
          {(pending === "absent" || (resp === "absent" && pending !== "late")) && (
            <input value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => resp === "absent" && send("absent", reason || null)}
              placeholder={t("player.convocations.reasonPlaceholder")} maxLength={120}
              style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          )}
          {(pending === "late" || (resp === "late" && pending !== "absent")) && (
            <input value={eta} onChange={(e) => setEta(e.target.value)} onBlur={() => resp === "late" && send("late", null, eta || null)}
              placeholder={t("player.convocations.etaPlaceholder")} maxLength={40}
              style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          )}
          {resp && <div style={{ fontSize: 10.5, fontWeight: 700, color: STATE_COLOR[resp], marginTop: 8 }}>{t("player.convocations.answered", { state: t(`staff.convocations.state.${resp}`) })}</div>}
        </>
      )}
    </div>
  );
}
