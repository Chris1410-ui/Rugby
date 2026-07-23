import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { ACTIVITIES } from "../../../lib/metrics.js";
import { CheckCircle, Send } from "../../../lib/icons.jsx";
import { saveCheckin } from "../../../data/checkins.js";
import { seedMorning, saveBtnProps } from "./parts.js";

/* Formulaire ACTIVITÉS du jour (salle/course/natation…). Les activités sont
   portées par le bilan MATIN : on réhydrate l'état matin COMPLET, on ne modifie
   que `activities`, et on ré-enregistre l'ensemble → aucun autre champ perdu.
   Formule points INCHANGÉE (+10 par thématique dans computePoints). */
export default function ActivitiesForm({ me, accent = C.green, day, preview, onSaved }) {
  const { t } = useTranslation();
  const [d, setD] = useState(() => seedMorning(me, day?.matin));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setD(seedMorning(me, day?.matin)); setSaved(false); }, [day?.matin]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => {
    setD((p) => { const has = (p.activities || []).includes(key); return { ...p, activities: has ? p.activities.filter((a) => a !== key) : [...(p.activities || []), key] }; });
    setSaved(false);
  };

  const save = async () => {
    if (preview) return;
    setBusy(true); setErr("");
    try { await saveCheckin(me.id, d, undefined, "matin"); setSaved(true); onSaved?.(); }
    catch (e) { setErr(e.message || t("player.bilan.saveFail")); }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginBottom: 12, lineHeight: 1.5 }}>{t("player.bilan.activityHint")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {ACTIVITIES.map((a) => {
          const on = (d.activities || []).includes(a.key);
          return (
            <button key={a.key} onClick={() => toggle(a.key)} disabled={preview} style={{ flex: "1 1 90px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 8px", borderRadius: 12, cursor: preview ? "default" : "pointer", background: on ? `${C.green}22` : "rgba(255,255,255,0.05)", border: `1.5px solid ${on ? C.green : C.border}`, color: "#fff", opacity: preview ? 0.6 : 1 }}>
              <span style={{ fontSize: 24 }}>{a.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{t("data.activities." + a.key)}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: on ? C.green : "rgba(255,255,255,0.5)" }}>{on ? t("player.bilan.activityOn") : t("player.bilan.activityDeclare")}</span>
            </button>
          );
        })}
      </div>

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, textAlign: "center" }}>{err}</div>}
      <button {...saveBtnProps({ preview, saved, busy, onClick: save, colorOn: accent })}>
        {preview ? t("common.previewReadonly") : saved ? (<><CheckCircle size={16} /> {t("player.today.activitiesSaved")}</>) : busy ? t("player.bilan.saving") : (<><Send size={16} /> {t("player.today.activitiesSave")}</>)}
      </button>
    </div>
  );
}
