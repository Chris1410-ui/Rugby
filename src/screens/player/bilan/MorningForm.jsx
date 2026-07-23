import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../lib/tokens.js";
import { wbToWellness, computeReadiness, acwrZ, sleepLabel } from "../../../lib/metrics.js";
import { Ring, Section } from "../../../lib/ui.jsx";
import { CheckCircle, Send } from "../../../lib/icons.jsx";
import { saveCheckin } from "../../../data/checkins.js";
import { WELL_KEYS, seedMorning, numInp, saveBtnProps } from "./parts.js";
import { Slider, SleepPicker } from "./parts.jsx";

/* Formulaire BILAN DU MATIN (bien-être, sommeil/hydratation, récupération) —
   extrait tel quel de l'ancien Bilan.jsx (formules readiness/points INCHANGÉES).
   Les activités restent dans l'état (préservées à l'enregistrement) mais sont
   éditées via le formulaire Activités dédié. Toujours le jour même. */
export default function MorningForm({ me, accent = C.green, day, preview, onSaved }) {
  const { t } = useTranslation();
  const [d, setD] = useState(() => seedMorning(me, day?.matin));
  const [saved, setSaved] = useState(!!day?.matin);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setD(seedMorning(me, day?.matin)); setSaved(!!day?.matin); }, [day?.matin]); // eslint-disable-line react-hooks/exhaustive-deps

  const setM = (patch) => { setD((p) => ({ ...p, ...patch })); setSaved(false); };
  const setWb = (k, v) => { setD((p) => ({ ...p, wb: { ...p.wb, [k]: v } })); setSaved(false); };

  const wbScore = wbToWellness(d.wb, d.sleepH) || 0;
  const readiness = computeReadiness(wbScore, me.risque, d.sleepH);

  const save = async () => {
    if (preview) return;
    setBusy(true); setErr("");
    try { await saveCheckin(me.id, d, undefined, "matin"); setSaved(true); onSaved?.(); }
    catch (e) { setErr(e.message || t("player.bilan.saveFail")); }
    setBusy(false);
  };

  return (
    <div>
      {/* Anneaux de synthèse (temps réel pendant la saisie). */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, display: "flex", justifyContent: "space-around", padding: 14, marginBottom: 16 }}>
        <Ring val={readiness} max={100} color={readiness > 70 ? C.green : readiness > 50 ? C.amb : C.coral} label={t("player.bilan.readiness")} size={62} />
        <Ring val={Math.round(me.acwr * 100)} max={200} color={acwrZ(me.acwr).c} label={t("player.bilan.ringCharge")} size={62} />
        <Ring val={wbScore} max={50} color={C.blue} label={t("player.bilan.ringWellbeing")} size={62} />
        <Ring val={Math.round((d.sleepH || 0) * 12.5)} max={100} color={C.viol} label={t("player.bilan.ringSleep")} size={62} />
      </div>

      <Section title={t("player.bilan.secWellbeing")}>
        {WELL_KEYS.map(([k, c]) => <Slider key={k} label={t(`player.bilan.markers.${k}`)} value={d.wb[k]} color={c} onChange={(v) => setWb(k, v)} />)}
      </Section>

      <Section title={t("player.bilan.secSleepHydration")}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{t("player.bilan.sleep")}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.viol }}>{sleepLabel(d.sleepH)}</span>
        </div>
        <SleepPicker value={d.sleepH} onChange={(v) => setM({ sleepH: v })} disabled={preview} />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{t("player.bilan.hydration")}</div>
          <input type="number" step="0.1" value={d.hydra ?? ""} onChange={(e) => setM({ hydra: parseFloat(e.target.value) || 0 })} style={numInp(C.teal)} />
        </div>
      </Section>

      <Section title={t("player.bilan.secRecovery")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[[t("player.bilan.recFc"), "fc", "bpm", C.coral], [t("player.bilan.recHrv"), "hrv", "ms", C.green], [t("player.bilan.recWeight"), "poids", "kg", C.blue]].map(([l, k, u, c]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{l}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <input type="number" value={d[k] ?? ""} onChange={(e) => setM({ [k]: e.target.value === "" ? null : parseFloat(e.target.value) })} style={numInp(c)} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.56)" }}>{u}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, textAlign: "center" }}>{err}</div>}
      <button {...saveBtnProps({ preview, saved, busy, onClick: save, colorOn: accent })}>
        {preview ? t("common.previewReadonly") : saved ? (<><CheckCircle size={16} /> {t("player.bilan.savedMorning")}</>) : busy ? t("player.bilan.saving") : (<><Send size={16} /> {t("player.bilan.saveMorning")}</>)}
      </button>
    </div>
  );
}
