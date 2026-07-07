import { useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { Section } from "../../lib/ui.jsx";

/* Comparaison intra-ligne (vue joueur). Métriques dérivées de l'effectif enrichi. */
const CMP = [
  { k: "readiness", l: "Readiness", fmt: (v) => Math.round(v), higher: true },
  { k: "acwr", l: "ACWR", fmt: (v) => v.toFixed(2), higher: null },
  { k: "wellness", l: "Bien-être", fmt: (v) => Math.round(v), higher: true },
  { k: "charge7j", l: "Charge 7j", fmt: (v) => Math.round(v), higher: true },
  { k: "backSquat", l: "Back Squat (×PDC)", fmt: (v) => Number(v).toFixed(2), higher: true },
  { k: "monotonie", l: "Monotonie", fmt: (v) => Number(v).toFixed(2), higher: false },
  { k: "risque", l: "Risque", fmt: (v) => Math.round(v), higher: false },
];

export default function Comparaison({ me, players, accent = C.green }) {
  const [mk, setMk] = useState("readiness");
  const peers = players.filter((p) => p.grp === me.grp);
  const metric = CMP.find((m) => m.k === mk);
  const vals = peers.map((p) => Number(p[mk]) || 0);
  const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
  const min = Math.min(...vals), max = Math.max(...vals);
  const sorted = [...peers].sort((a, b) => (metric.higher === false ? a[mk] - b[mk] : b[mk] - a[mk]));
  const rank = sorted.findIndex((p) => p.id === me.id) + 1;
  const pct = max === min ? 50 : ((Number(me[mk]) - min) / (max - min)) * 100;
  const better = metric.higher === null ? null : metric.higher ? me[mk] >= avg : me[mk] <= avg;

  return (
    <div>
      <div style={sc({ marginBottom: 12 })}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>MON POSITIONNEMENT · {metric.l.toUpperCase()}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: accent }}>{metric.fmt(me[mk])}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>moyenne {metric.fmt(avg)}</span>
        </div>
        <div style={{ fontSize: 12, color: better === null ? "rgba(255,255,255,0.5)" : better ? C.green : C.amb, fontWeight: 600, marginBottom: 14 }}>
          {rank}{rank === 1 ? "ᵉʳ" : "ᵉ"} sur {peers.length} · {grpLabel(me.grp)} {better === null ? "" : better ? "· au-dessus de la moyenne" : "· sous la moyenne"}
        </div>
        <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 6 }}>
          <div style={{ position: "absolute", left: `${((avg - min) / (max - min || 1)) * 100}%`, top: -3, width: 2, height: 14, background: "rgba(255,255,255,0.4)" }} />
          <div style={{ position: "absolute", left: `calc(${pct}% - 7px)`, top: -3, width: 14, height: 14, borderRadius: 7, background: accent, border: "2px solid #fff" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.35)" }}><span>min {metric.fmt(min)}</span><span>moy.</span><span>max {metric.fmt(max)}</span></div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {CMP.map((m) => <button key={m.k} onClick={() => setMk(m.k)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "7px 12px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", background: mk === m.k ? accent : "rgba(255,255,255,0.07)", color: "#fff" }}>{m.l}</button>)}
      </div>

      <Section title={`CLASSEMENT · ${metric.l} · ${grpLabel(me.grp)}`}>
        {sorted.map((p, i) => {
          const isMe = p.id === me.id;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: `1px solid ${C.border2}`, background: isMe ? `${accent}14` : "none", borderRadius: isMe ? 8 : 0 }}>
              <span style={{ width: 22, fontSize: 13, fontWeight: 800, color: i === 0 ? accent : "rgba(255,255,255,0.4)" }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 800 : 500 }}>{isMe ? "Moi — " + p.name : p.name}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: isMe ? accent : "rgba(255,255,255,0.7)" }}>{metric.fmt(p[mk])}</span>
            </div>
          );
        })}
      </Section>
    </div>
  );
}
