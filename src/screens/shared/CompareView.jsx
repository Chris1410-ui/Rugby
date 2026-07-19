import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { fmtShort } from "../../lib/metrics.js";
import { TOP14_TESTS, catLabel } from "../../lib/top14.js";

/* Vue de comparaison PARTAGÉE (staff & joueur). Reçoit deux profils déjà
   calculés (cf. lib/compare.js) et les rend à l'identique : cartouches d'identité,
   tableau des 9 tests + écarts, barres normalisées en % du seuil Top 14, radar.
   Aucune logique de données ici → même rendu quelle que soit la source
   (client staff, ou agrégats serveur côté joueur). */

export const A_COL = C.green, B_COL = C.viol, T14_COL = "#F2C84B";
const DEC = { squat: 2, bench: 2, deadlift: 2, hangclean: 2, tractions: 2, mas: 2, yoyo: 0, cmj: 0 };

function fmtVal(key, v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (key === "bronco") return `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  return v.toFixed(DEC[key] ?? 1);
}

const headTitle = (d) => (d.label ? d.label : d.player ? displayName(d.player) : "—");

export default function CompareView({ A, B }) {
  if (!A || !B) {
    return <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>Sélectionne deux profils à comparer.</div>;
  }
  return (
    <>
      {/* Cartouches identité */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <ProfileHead data={A} color={A_COL} tag="A" />
        <ProfileHead data={B} color={B_COL} tag="B" />
      </div>

      {/* Tableau des tests */}
      <div style={sc({ padding: 0, overflow: "hidden", marginBottom: 12 })}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              <th style={thL}>Test</th>
              <th style={{ ...thR, color: A_COL }}>{headTitle(A)}</th>
              <th style={{ ...thR, color: B_COL }}>{headTitle(B)}</th>
              <th style={thR}>Écart</th>
            </tr>
          </thead>
          <tbody>
            {TOP14_TESTS.map((t) => {
              const ea = A.byTest[t.key], eb = B.byTest[t.key];
              const a = ea?.value, b = eb?.value;
              const both = a != null && b != null;
              const aBetter = both && (t.dir === "down" ? a < b : a > b);
              const bBetter = both && (t.dir === "down" ? b < a : b > a);
              const delta = both ? a - b : null;
              const dec = DEC[t.key] ?? 1;
              const deltaStr = delta == null ? "—"
                : t.key === "bronco" ? `${delta > 0 ? "+" : ""}${Math.round(delta)}s`
                : `${delta > 0 ? "+" : ""}${delta.toFixed(dec)}`;
              const dCol = !both ? "rgba(255,255,255,0.4)" : aBetter ? A_COL : bBetter ? B_COL : "rgba(255,255,255,0.6)";
              return (
                <tr key={t.key} style={{ borderTop: `1px solid ${C.border2}` }}>
                  <td style={tdL}>{t.label}<span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5 }}>{t.unit ? ` ${t.unit}` : ""}</span></td>
                  <td style={{ ...tdR, color: "#fff" }}>{fmtVal(t.key, a)}{ea?.valid && <span title="Top 14 atteint" style={{ color: T14_COL, marginLeft: 3 }}>★</span>}</td>
                  <td style={{ ...tdR, color: "#fff" }}>{fmtVal(t.key, b)}{eb?.valid && <span title="Top 14 atteint" style={{ color: T14_COL, marginLeft: 3 }}>★</span>}</td>
                  <td style={{ ...tdR, color: dCol, fontWeight: 800 }}>{deltaStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barres comparatives (% du seuil Top 14) */}
      <div style={sc({ marginBottom: 12 })}>
        <SectionTitle>Barres · % du seuil Top 14 (100 % = Top 14)</SectionTitle>
        {TOP14_TESTS.map((t) => (
          <BarRow key={t.key} label={t.label} a={A.byTest[t.key]?.pct} b={B.byTest[t.key]?.pct} />
        ))}
        <Legend aLabel={headTitle(A)} bLabel={headTitle(B)} />
      </div>

      {/* Radar */}
      <div style={sc({ display: "flex", flexDirection: "column", alignItems: "center" })}>
        <SectionTitle>Radar · profil physique (repère Top 14)</SectionTitle>
        <Radar a={A} b={B} />
        <Legend aLabel={headTitle(A)} bLabel={headTitle(B)} />
      </div>
    </>
  );
}

const thL = { textAlign: "left", padding: "9px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 };
const thR = { textAlign: "right", padding: "9px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 };
const tdL = { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "rgba(255,255,255,0.8)" };
const tdR = { textAlign: "right", padding: "8px 10px", fontVariantNumeric: "tabular-nums" };

function SectionTitle({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 10, alignSelf: "flex-start" }}>{children}</div>;
}

function ProfileHead({ data, color, tag }) {
  const title = headTitle(data);
  const sub = data.isAverage ? `moyenne · ${data.members} joueur${data.members > 1 ? "s" : ""}` : catLabel(data.cat);
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}55`, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: 1 }}>{tag}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{sub}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
        <span style={{ color: T14_COL, fontWeight: 800 }}>{data.count}/9</span> Top 14 · {data.lastDate ? `${data.isAverage ? "MàJ" : "test"} ${fmtShort(data.lastDate)}` : (data.isAverage ? "aucune donnée" : "aucun test")}
      </div>
    </div>
  );
}

function BarRow({ label, a, b }) {
  const MAX = 150;
  const w = (v) => (v == null ? 0 : Math.max(0, Math.min(100, (v / MAX) * 100)));
  const t14 = (100 / MAX) * 100;
  const bar = (v, col) => (
    <div style={{ position: "relative", height: 9, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden", flex: 1 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w(v)}%`, background: col, borderRadius: 5 }} />
      <div style={{ position: "absolute", left: `${t14}%`, top: -1, bottom: -1, width: 2, background: T14_COL }} />
    </div>
  );
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>{bar(a, A_COL)}<span style={{ width: 34, textAlign: "right", fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>{a == null ? "—" : `${Math.round(a)}%`}</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{bar(b, B_COL)}<span style={{ width: 34, textAlign: "right", fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>{b == null ? "—" : `${Math.round(b)}%`}</span></div>
    </div>
  );
}

function Legend({ aLabel = "A", bLabel = "B" }) {
  const dot = (c, l) => (<span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "rgba(255,255,255,0.6)", maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0 }} />{l}</span>);
  return <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>{dot(A_COL, aLabel)}{dot(B_COL, bLabel)}{dot(T14_COL, "Top 14")}</div>;
}

function Radar({ a, b }) {
  const size = 280, c = size / 2, R = c - 34, MAXN = 1.5;
  const axes = TOP14_TESTS;
  const ang = (i) => (-90 + i * (360 / axes.length)) * (Math.PI / 180);
  const pt = (norm, i) => {
    const r = R * Math.max(0, Math.min(MAXN, norm)) / MAXN;
    return [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  };
  const ring = (norm) => axes.map((_, i) => pt(norm, i).join(",")).join(" ");
  const poly = (data) => axes.map((t, i) => pt((data.byTest[t.key]?.pct ?? 0) / 100, i).join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: "100%" }}>
      {[0.5, 1.5].map((n) => <polygon key={n} points={ring(n)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />)}
      <polygon points={ring(1)} fill="none" stroke={T14_COL} strokeWidth="1.5" strokeDasharray="4 4" />
      {axes.map((t, i) => { const [x, y] = pt(MAXN, i); return <line key={t.key} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />; })}
      <polygon points={poly(a)} fill={`${A_COL}33`} stroke={A_COL} strokeWidth="2" />
      <polygon points={poly(b)} fill={`${B_COL}33`} stroke={B_COL} strokeWidth="2" />
      {axes.map((t, i) => {
        const [x, y] = pt(MAXN + 0.18, i);
        return <text key={t.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fill="rgba(255,255,255,0.6)" fontWeight="700">{t.label.split(" ")[0]}</text>;
      })}
    </svg>
  );
}
