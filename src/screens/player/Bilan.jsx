import { useEffect, useState } from "react";
import { C } from "../../lib/tokens.js";
import { wbToWellness, computeReadiness, acwrZ, ACTIVITIES, EVENING_MARKERS, SLEEP_OPTIONS, sleepLabel } from "../../lib/metrics.js";
import { Ring, Section } from "../../lib/ui.jsx";
import { CheckCircle, Send } from "../../lib/icons.jsx";
import { useMyDay, saveCheckin } from "../../data/checkins.js";
import { usePreview } from "../../lib/preview.js";

const WELL_KEYS = [
  ["sleep", "Sommeil", C.viol],
  ["energy", "Énergie", C.green],
  ["fatigue", "Fatigue", C.coral],
  ["soreness", "Courbatures", C.amb],
  ["mood", "Humeur", C.blue],
  ["stress", "Stress", C.teal],
];

const morningDefaults = (me) => ({
  wb: { sleep: 7, energy: 6, fatigue: 4, soreness: 4, mood: 7, stress: 4 },
  sleepH: me?.sleep ? Number(me.sleep) : 7.5,
  hydra: 2.0,
  fc: null,
  hrv: null,
  poids: null,
  activities: [],
});
const eveningDefaults = () => ({ quality: 6, intensity: 6, difficulty: 5, fatigue: 5, moral: 7, motivation: 7, ressentiMatch: "", remarques: "" });

const hhmm = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }).replace(":", "h"); }
  catch { return ""; }
};

// Bandeau d'état d'un bloc (à remplir / complété ✓ à HHhMM).
const BlockState = ({ done, at }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: done ? `${C.green}22` : "rgba(255,255,255,0.06)", border: `1px solid ${done ? C.green + "66" : C.border}`, color: done ? C.green : "rgba(255,255,255,0.6)" }}>
    {done ? `complété ✓${at ? ` à ${at}` : ""}` : "à remplir"}
  </span>
);

const Slider = ({ label, value, color, onChange }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}/10</span>
    </div>
    <input type="range" min="1" max="10" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: color, height: 4 }} />
  </div>
);

/* Sélecteur d'heures de sommeil en tranches de 30 min (grille de boutons, wrap).
   Le joueur clique la bonne durée ; la valeur décimale (7.5) reste stockée.
   Cibles ≥44px, style actif violet, thème sombre. Désactivé en aperçu. */
const SleepPicker = ({ value, onChange, disabled }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {SLEEP_OPTIONS.map((h) => {
      const on = Number(value) === h;
      return (
        <button
          key={h}
          type="button"
          onClick={() => !disabled && onChange(h)}
          disabled={disabled}
          aria-pressed={on}
          style={{
            flex: "1 0 auto", minWidth: 58, minHeight: 44, padding: "0 12px",
            borderRadius: 10, cursor: disabled ? "default" : "pointer",
            background: on ? C.viol : "rgba(255,255,255,0.06)",
            border: `1.5px solid ${on ? C.viol : C.border}`,
            color: on ? "#fff" : "rgba(255,255,255,0.75)",
            fontSize: 13.5, fontWeight: on ? 800 : 600, opacity: disabled ? 0.55 : 1,
          }}
        >
          {sleepLabel(h)}
        </button>
      );
    })}
  </div>
);

export default function Bilan({ me, accent }) {
  const preview = usePreview(); // aperçu owner/staff → lecture seule
  const { day, refresh } = useMyDay(me.id);

  // ── État matin (inchangé) ──
  const [d, setD] = useState(morningDefaults(me));
  const [savedM, setSavedM] = useState(false);
  const [busyM, setBusyM] = useState(false);
  const [errM, setErrM] = useState("");

  // ── État soir ──
  const [s, setS] = useState(eveningDefaults());
  const [savedS, setSavedS] = useState(false);
  const [busyS, setBusyS] = useState(false);
  const [errS, setErrS] = useState("");

  // (Re)initialise depuis les bilans persistés du jour.
  useEffect(() => {
    if (day.matin) {
      setD({
        wb: { ...morningDefaults(me).wb, ...day.matin.wb },
        sleepH: day.matin.sleepH ?? morningDefaults(me).sleepH,
        hydra: day.matin.hydra ?? 2.0,
        fc: day.matin.fc ?? null,
        hrv: day.matin.hrv ?? null,
        poids: day.matin.poids ?? null,
        activities: day.matin.activities ?? [],
      });
      setSavedM(true);
    }
    if (day.soir) { setS({ ...eveningDefaults(), ...(day.soir.wb || {}) }); setSavedS(true); }
  }, [day.matin, day.soir]); // eslint-disable-line react-hooks/exhaustive-deps

  const setM = (patch) => { setD((p) => ({ ...p, ...patch })); setSavedM(false); };
  const setWb = (k, v) => { setD((p) => ({ ...p, wb: { ...p.wb, [k]: v } })); setSavedM(false); };
  const setSoir = (k, v) => { setS((p) => ({ ...p, [k]: v })); setSavedS(false); };
  const toggleActivity = (key) => {
    setD((p) => {
      const has = (p.activities || []).includes(key);
      return { ...p, activities: has ? p.activities.filter((a) => a !== key) : [...(p.activities || []), key] };
    });
    setSavedM(false);
  };

  const wbScore = wbToWellness(d.wb, d.sleepH) || 0;
  const readiness = computeReadiness(wbScore, me.risque, d.sleepH);

  const saveMorning = async () => {
    if (preview) return;
    setBusyM(true); setErrM("");
    try { await saveCheckin(me.id, d, undefined, "matin"); setSavedM(true); refresh(); }
    catch (e) { setErrM(e.message || "Échec de l'enregistrement."); }
    setBusyM(false);
  };
  const saveEvening = async () => {
    if (preview) return;
    setBusyS(true); setErrS("");
    try { await saveCheckin(me.id, { wb: s }, undefined, "soir"); setSavedS(true); refresh(); }
    catch (e) { setErrS(e.message || "Échec de l'enregistrement."); }
    setBusyS(false);
  };

  const numInp = (c) => ({ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 8px", color: c, fontSize: 15, fontWeight: 700, outline: "none" });
  const txtInp = { width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", minHeight: 60, boxSizing: "border-box" };
  const saveBtn = (saved, busy, onClick, colorOn) => ({ onClick, disabled: preview || saved || busy, style: { width: "100%", background: preview ? "rgba(255,255,255,0.06)" : saved ? "rgba(44,140,90,0.2)" : colorOn, border: preview ? `1px solid ${C.border}` : saved ? `1px solid ${C.green}66` : "none", borderRadius: 12, padding: 14, color: preview ? "rgba(255,255,255,0.6)" : saved ? C.green : "#fff", fontWeight: 700, fontSize: 14, cursor: preview || saved ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 18, opacity: busy ? 0.7 : 1 } });

  return (
    <div>
      {/* readiness + identité (matin) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 14, padding: 16, marginBottom: 12 }}>
        <Ring val={readiness} max={100} color={readiness > 70 ? C.green : readiness > 50 ? C.amb : C.coral} label="readiness" size={78} sw={6} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 700 }}>
            AUJOURD'HUI · {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{me.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{me.pos}</div>
        </div>
      </div>

      {/* anneaux synthèse (matin) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, display: "flex", justifyContent: "space-around", padding: 14, marginBottom: 16 }}>
        <Ring val={Math.round(me.acwr * 100)} max={200} color={acwrZ(me.acwr).c} label="Charge" size={62} />
        <Ring val={wbScore} max={50} color={C.blue} label="Bien-être" size={62} />
        <Ring val={Math.round((d.sleepH || 0) * 12.5)} max={100} color={C.viol} label="Sommeil" size={62} />
        <Ring val={Math.round(((d.hydra || 0) / 3.5) * 100)} max={100} color={C.teal} label="Hydrat." size={62} />
      </div>

      {/* ═══════════ BLOC MATIN ═══════════ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 900, flex: 1 }}>☀️ Matin</div>
        <BlockState done={!!day.matin} at={hhmm(day.matin?.createdAt)} />
      </div>

      <Section title="BIEN-ÊTRE — 6 MARQUEURS">
        {WELL_KEYS.map(([k, l, c]) => <Slider key={k} label={l} value={d.wb[k]} color={c} onChange={(v) => setWb(k, v)} />)}
      </Section>

      <Section title="SOMMEIL & HYDRATATION">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Sommeil</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.viol }}>{sleepLabel(d.sleepH)}</span>
        </div>
        <SleepPicker value={d.sleepH} onChange={(v) => setM({ sleepH: v })} disabled={preview} />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>Hydratation (L)</div>
          <input type="number" step="0.1" value={d.hydra ?? ""} onChange={(e) => setM({ hydra: parseFloat(e.target.value) || 0 })} style={numInp(C.teal)} />
        </div>
      </Section>

      <Section title="RÉCUPÉRATION (optionnel)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[["FC repos", "fc", "bpm", C.coral], ["HRV", "hrv", "ms", C.green], ["Poids matin", "poids", "kg", C.blue]].map(([l, k, u, c]) => (
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

      <span id="activite-jour" />
      <Section title="ACTIVITÉ DU JOUR" right={<span style={{ fontSize: 9, color: C.green, fontWeight: 700 }}>+10 pts / thématique</span>}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 10, lineHeight: 1.5 }}>
          Déclare ce que tu as fait aujourd'hui — chaque thématique déclarée te rapporte 10 points au classement.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ACTIVITIES.map((a) => {
            const on = (d.activities || []).includes(a.key);
            return (
              <button key={a.key} onClick={() => toggleActivity(a.key)} style={{ flex: "1 1 90px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 8px", borderRadius: 12, cursor: "pointer", background: on ? `${C.green}22` : "rgba(255,255,255,0.05)", border: `1.5px solid ${on ? C.green : C.border}`, color: "#fff" }}>
                <span style={{ fontSize: 24 }}>{a.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{a.label}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: on ? C.green : "rgba(255,255,255,0.5)" }}>{on ? "✓ +10 pts" : "déclarer"}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {errM && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, textAlign: "center" }}>{errM}</div>}
      <button {...saveBtn(savedM, busyM, saveMorning, accent || C.green)}>
        {preview ? "👁 Mode aperçu — lecture seule" : savedM ? (<><CheckCircle size={16} /> Bilan du matin enregistré (+10)</>) : busyM ? "Enregistrement…" : (<><Send size={16} /> Enregistrer le bilan du matin</>)}
      </button>

      {/* ═══════════ BLOC SOIR ═══════════ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 10px" }}>
        <div style={{ fontSize: 16, fontWeight: 900, flex: 1 }}>🌙 Soir</div>
        <BlockState done={!!day.soir} at={hhmm(day.soir?.createdAt)} />
      </div>

      <Section title="RESSENTI DE LA JOURNÉE / DU MATCH — 6 MARQUEURS">
        {EVENING_MARKERS.map((m, i) => {
          const col = [C.blue, C.amb, C.viol, C.coral, C.green, C.teal][i % 6];
          return <Slider key={m.k} label={m.l} value={s[m.k]} color={col} onChange={(v) => setSoir(m.k, v)} />;
        })}
      </Section>

      <Section title="RESSENTI DU MATCH">
        <textarea value={s.ressentiMatch} onChange={(e) => setSoir("ressentiMatch", e.target.value)} placeholder="Comment s'est passé ton match / ta séance ?" style={txtInp} />
      </Section>
      <Section title="REMARQUES">
        <textarea value={s.remarques} onChange={(e) => setSoir("remarques", e.target.value)} placeholder="Douleurs, points de vigilance, note pour le staff…" style={txtInp} />
      </Section>

      {errS && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, textAlign: "center" }}>{errS}</div>}
      <button {...saveBtn(savedS, busyS, saveEvening, accent || C.green)}>
        {preview ? "👁 Mode aperçu — lecture seule" : savedS ? (<><CheckCircle size={16} /> Bilan du soir enregistré (+10)</>) : busyS ? "Enregistrement…" : (<><Send size={16} /> Enregistrer le bilan du soir</>)}
      </button>
      <div style={{ height: 8 }} />
    </div>
  );
}
