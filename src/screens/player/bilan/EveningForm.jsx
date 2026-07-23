import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { EVENING_MARKERS } from "../../../lib/metrics.js";
import { Section } from "../../../lib/ui.jsx";
import { CheckCircle, Send } from "../../../lib/icons.jsx";
import { saveCheckin } from "../../../data/checkins.js";
import { eveningDefaults, txtInp, saveBtnProps } from "./parts.js";
import { Slider } from "./parts.jsx";

/* Formulaire BILAN DU SOIR (marqueurs, ressenti match, remarques) — extrait tel
   quel de l'ancien Bilan.jsx (formules/points INCHANGÉS). Jour même. */
export default function EveningForm({ me, accent = C.green, day, preview, onSaved }) {
  const { t } = useTranslation();
  const [s, setS] = useState(() => ({ ...eveningDefaults(), ...(day?.soir?.wb || {}) }));
  const [saved, setSaved] = useState(!!day?.soir);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setS({ ...eveningDefaults(), ...(day?.soir?.wb || {}) }); setSaved(!!day?.soir); }, [day?.soir]);

  const setSoir = (k, v) => { setS((p) => ({ ...p, [k]: v })); setSaved(false); };

  const save = async () => {
    if (preview) return;
    setBusy(true); setErr("");
    try { await saveCheckin(me.id, { wb: s }, undefined, "soir"); setSaved(true); onSaved?.(); }
    catch (e) { setErr(e.message || t("player.bilan.saveFail")); }
    setBusy(false);
  };

  return (
    <div>
      <Section title={t("player.bilan.secEveningMarkers")}>
        {EVENING_MARKERS.map((m, i) => {
          const col = [C.blue, C.amb, C.viol, C.coral, C.green, C.teal][i % 6];
          return <Slider key={m.k} label={t("data.evening." + m.k)} value={s[m.k]} color={col} onChange={(v) => setSoir(m.k, v)} />;
        })}
      </Section>

      <Section title={t("player.bilan.secMatchFeeling")}>
        <textarea value={s.ressentiMatch} onChange={(e) => setSoir("ressentiMatch", e.target.value)} placeholder={t("player.bilan.matchPlaceholder")} style={txtInp} />
      </Section>
      <Section title={t("player.bilan.secRemarks")}>
        <textarea value={s.remarques} onChange={(e) => setSoir("remarques", e.target.value)} placeholder={t("player.bilan.remarksPlaceholder")} style={txtInp} />
      </Section>

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, textAlign: "center" }}>{err}</div>}
      <button {...saveBtnProps({ preview, saved, busy, onClick: save, colorOn: accent })}>
        {preview ? t("common.previewReadonly") : saved ? (<><CheckCircle size={16} /> {t("player.bilan.savedEvening")}</>) : busy ? t("player.bilan.saving") : (<><Send size={16} /> {t("player.bilan.saveEvening")}</>)}
      </button>
    </div>
  );
}
