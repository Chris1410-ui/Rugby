import { useEffect, useState } from "react";
import { C } from "../../lib/tokens.js";
import { wbToWellness, computeReadiness, acwrZ } from "../../lib/metrics.js";
import { Ring, Section } from "../../lib/ui.jsx";
import { CheckCircle, Send } from "../../lib/icons.jsx";
import { useMyCheckin, saveCheckin } from "../../data/checkins.js";

const WELL_KEYS = [
  ["sleep", "Sommeil", C.viol],
  ["energy", "Énergie", C.green],
  ["fatigue", "Fatigue", C.coral],
  ["soreness", "Courbatures", C.amb],
  ["mood", "Humeur", C.blue],
  ["stress", "Stress", C.teal],
];

const defaults = (me) => ({
  wb: { sleep: 7, energy: 6, fatigue: 4, soreness: 4, mood: 7, stress: 4 },
  sleepH: me?.sleep ? Number(me.sleep) : 7.5,
  hydra: 2.0,
  fc: null,
  hrv: null,
  poids: null,
});

export default function Bilan({ me, accent }) {
  const { checkin, loading, refresh } = useMyCheckin(me.id);
  const [d, setD] = useState(defaults(me));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // (Re)initialise depuis le bilan persisté du jour
  useEffect(() => {
    if (checkin) {
      setD({
        wb: { ...defaults(me).wb, ...checkin.wb },
        sleepH: checkin.sleepH ?? defaults(me).sleepH,
        hydra: checkin.hydra ?? 2.0,
        fc: checkin.fc ?? null,
        hrv: checkin.hrv ?? null,
        poids: checkin.poids ?? null,
      });
      setSaved(true);
    }
  }, [checkin]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => { setD((p) => ({ ...p, ...patch })); setSaved(false); };
  const setWb = (k, v) => { setD((p) => ({ ...p, wb: { ...p.wb, [k]: v } })); setSaved(false); };

  const wbScore = wbToWellness(d.wb, d.sleepH) || 0;
  const readiness = computeReadiness(wbScore, me.risque, d.sleepH);

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await saveCheckin(me.id, d);
      setSaved(true);
      refresh();
    } catch (e) {
      setErr(e.message || "Échec de l'enregistrement.");
    }
    setBusy(false);
  };

  const numInp = (c) => ({ width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 8px", color: c, fontSize: 15, fontWeight: 700, outline: "none" });

  return (
    <div>
      {/* readiness + identité */}
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

      {/* anneaux synthèse */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, display: "flex", justifyContent: "space-around", padding: 14, marginBottom: 12 }}>
        <Ring val={Math.round(me.acwr * 100)} max={200} color={acwrZ(me.acwr).c} label="Charge" size={62} />
        <Ring val={wbScore} max={50} color={C.blue} label="Bien-être" size={62} />
        <Ring val={Math.round((d.sleepH || 0) * 12.5)} max={100} color={C.viol} label="Sommeil" size={62} />
        <Ring val={Math.round(((d.hydra || 0) / 3.5) * 100)} max={100} color={C.teal} label="Hydrat." size={62} />
      </div>

      <Section title="BIEN-ÊTRE — 6 MARQUEURS">
        {WELL_KEYS.map(([k, l, c]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{d.wb[k]}/10</span>
            </div>
            <input type="range" min="1" max="10" value={d.wb[k]} onChange={(e) => setWb(k, parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: c, height: 4 }} />
          </div>
        ))}
      </Section>

      <Section title="SOMMEIL & HYDRATATION">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>Sommeil (heures)</div>
            <input type="number" step="0.5" value={d.sleepH ?? ""} onChange={(e) => set({ sleepH: parseFloat(e.target.value) || 0 })} style={numInp(C.viol)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>Hydratation (L)</div>
            <input type="number" step="0.1" value={d.hydra ?? ""} onChange={(e) => set({ hydra: parseFloat(e.target.value) || 0 })} style={numInp(C.teal)} />
          </div>
        </div>
      </Section>

      <Section title="RÉCUPÉRATION (optionnel)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[["FC repos", "fc", "bpm", C.coral], ["HRV", "hrv", "ms", C.green], ["Poids matin", "poids", "kg", C.blue]].map(([l, k, u, c]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 5 }}>{l}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <input type="number" value={d[k] ?? ""} onChange={(e) => set({ [k]: e.target.value === "" ? null : parseFloat(e.target.value) })} style={numInp(c)} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.56)" }}>{u}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {err && <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, textAlign: "center" }}>{err}</div>}
      <button
        onClick={save}
        disabled={saved || busy || loading}
        style={{ width: "100%", background: saved ? "rgba(44,140,90,0.2)" : accent || C.green, border: saved ? `1px solid ${C.green}66` : "none", borderRadius: 12, padding: 14, color: saved ? C.green : "#fff", fontWeight: 700, fontSize: 14, cursor: saved ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20, opacity: busy ? 0.7 : 1 }}
      >
        {saved ? (<><CheckCircle size={16} /> Journée enregistrée</>) : busy ? "Enregistrement…" : (<><Send size={16} /> Enregistrer la journée</>)}
      </button>
    </div>
  );
}
