/* ════════════════════════════════════════════════════════════════
   charts.jsx — petits graphiques SVG/DOM autonomes (aucune dépendance,
   compatibles CSP). Utilisés par l'écran « Historique des bilans ».
   ════════════════════════════════════════════════════════════════ */
import { C } from "./tokens.js";

/* Courbes multi-séries. series = [{ name, color, pts:[number|null] }] alignées
   sur les mêmes X (labels). Les trous (null) coupent la ligne. */
export function MultiLine({ series, labels = [], height = 150, yMax }) {
  const w = 340, h = height, padL = 28, padR = 8, padT = 10, padB = 18;
  const n = Math.max(1, ...series.map((s) => s.pts.length));
  const vals = series.flatMap((s) => s.pts).filter((v) => v != null && Number.isFinite(v));
  const max = yMax || Math.max(1, ...vals);
  const X = (i) => padL + (i * (w - padL - padR)) / ((n - 1) || 1);
  const Y = (v) => h - padB - (v / max) * (h - padT - padB);
  const path = (pts) => {
    let d = "", started = false;
    pts.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) { started = false; return; }
      d += `${started ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `;
      started = true;
    });
    return d;
  };
  const gy = [0, 0.5, 1].map((f) => max * f);
  const step = Math.max(1, Math.floor(n / 6));
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        {gy.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={Y(v)} x2={w - padR} y2={Y(v)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x="2" y={Y(v) + 3} fontSize="8" fill="rgba(255,255,255,0.4)">{Math.round(v)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % step === 0 ? <text key={i} x={X(i)} y={h - 5} fontSize="7.5" fill="rgba(255,255,255,0.4)" textAnchor="middle">{l}</text> : null))}
        {series.map((s) => <path key={s.name} d={path(s.pts)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />)}
      </svg>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
        {series.map((s) => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,0.7)" }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Barres horizontales (comparaison joueurs). data = [{ label, value, color }]. */
export function Bars({ data, unit = "", max: maxProp }) {
  const max = maxProp || Math.max(1, ...data.map((d) => d.value || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 78, fontSize: 10.5, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, height: 14, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: 14, width: `${Math.min(100, ((d.value || 0) / max) * 100)}%`, background: d.color || C.blue, borderRadius: 4 }} />
          </div>
          <span style={{ width: 40, textAlign: "right", fontSize: 10.5, fontWeight: 700, color: d.color || "#fff", flexShrink: 0 }}>{d.value == null ? "—" : `${Math.round(d.value)}${unit}`}</span>
        </div>
      ))}
    </div>
  );
}

/* Donut. slices = [{ label, value, color }]. Légende avec %. */
export function Donut({ slices, size = 130, centerLabel }) {
  const total = slices.reduce((a, s) => a + (s.value || 0), 0);
  const r = size / 2, cx = r, cy = r, rr = r - 6, ir = rr * 0.6;
  const arc = (a0, a1) => {
    const p = (a, rad) => [cx + rad * Math.cos(a - Math.PI / 2), cy + rad * Math.sin(a - Math.PI / 2)];
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = p(a0, rr), [x1, y1] = p(a1, rr), [x2, y2] = p(a1, ir), [x3, y3] = p(a0, ir);
    return `M${x0} ${y0} A${rr} ${rr} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={(rr + ir) / 2} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={rr - ir} />
        ) : slices.filter((s) => s.value > 0).map((s, i) => {
          const a0 = (acc / total) * 2 * Math.PI; acc += s.value; const a1 = (acc / total) * 2 * Math.PI;
          return <path key={i} d={arc(a0, a1 - 0.001)} fill={s.color} />;
        })}
        {centerLabel && <text x={cx} y={cy + 4} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">{centerLabel}</text>}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {slices.map((s) => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} /> {s.label}
            <b style={{ color: "#fff" }}>{total ? Math.round((s.value / total) * 100) : 0}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* Heatmap joueurs × jours. rows=[{label, cells:[{v, color}]}], colLabels=[...] */
export function Heatmap({ rows, colLabels = [] }) {
  const step = Math.max(1, Math.floor(colLabels.length / 8));
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 3, minWidth: "100%" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 70, fontSize: 9.5, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} title={c.v == null ? "—" : String(Math.round(c.v))} style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0, background: c.color }} />
            ))}
          </div>
        ))}
        <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
          <span style={{ width: 70, flexShrink: 0 }} />
          {colLabels.map((l, i) => (
            <span key={i} style={{ width: 13, fontSize: 6.5, color: "rgba(255,255,255,0.4)", textAlign: "center", flexShrink: 0, whiteSpace: "nowrap" }}>{i % step === 0 ? l : ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
