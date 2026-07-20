import { useTranslation } from "react-i18next";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { fmtShort } from "../../lib/metrics.js";
import { TOP14_TESTS, catLabel } from "../../lib/top14.js";

/* Vue de comparaison PARTAGÉE (staff & joueur). Reçoit deux profils déjà
   calculés (cf. lib/compare.js) et les rend à l'identique : cartouches d'identité,
   tableau des 9 tests + écarts, barres normalisées en % du seuil Top 14, radar.
   Aucune logique de données ici → même rendu quelle que soit la source. Textes
   via i18n (namespace `compare`). */

export const A_COL = C.green, B_COL = C.viol, T14_COL = "#F2C84B";
const DEC = { squat: 2, bench: 2, deadlift: 2, hangclean: 2, tractions: 2, mas: 2, yoyo: 0, cmj: 0 };

function fmtVal(key, v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (key === "bronco") return `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  return v.toFixed(DEC[key] ?? 1);
}

const headTitle = (d) => (d.label ? d.label : d.player ? displayName(d.player) : "—");

export default function CompareView({ A, B }) {
  const { t } = useTranslation();
  if (!A || !B) {
    return <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>{t("compare.selectTwo")}</div>;
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
              <th style={thL}>{t("compare.colTest")}</th>
              <th style={{ ...thR, color: A_COL }}>{headTitle(A)}</th>
              <th style={{ ...thR, color: B_COL }}>{headTitle(B)}</th>
              <th style={thR}>{t("compare.colGap")}</th>
            </tr>
          </thead>
          <tbody>
            {TOP14_TESTS.map((tst) => {
              const ea = A.byTest[tst.key], eb = B.byTest[tst.key];
              const a = ea?.value, b = eb?.value;
              const both = a != null && b != null;
              const aBetter = both && (tst.dir === "down" ? a < b : a > b);
              const bBetter = both && (tst.dir === "down" ? b < a : b > a);
              const delta = both ? a - b : null;
              const dec = DEC[tst.key] ?? 1;
              const deltaStr = delta == null ? "—"
                : tst.key === "bronco" ? `${delta > 0 ? "+" : ""}${Math.round(delta)}s`
                : `${delta > 0 ? "+" : ""}${delta.toFixed(dec)}`;
              const dCol = !both ? "rgba(255,255,255,0.4)" : aBetter ? A_COL : bBetter ? B_COL : "rgba(255,255,255,0.6)";
              return (
                <tr key={tst.key} style={{ borderTop: `1px solid ${C.border2}` }}>
                  <td style={tdL}>{t("data.top14test." + tst.key)}<span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5 }}>{tst.unit ? ` ${tst.unit}` : ""}</span></td>
                  <td style={{ ...tdR, color: "#fff" }}>{fmtVal(tst.key, a)}{ea?.valid && <span title={t("compare.top14Reached")} style={{ color: T14_COL, marginLeft: 3 }}>★</span>}</td>
                  <td style={{ ...tdR, color: "#fff" }}>{fmtVal(tst.key, b)}{eb?.valid && <span title={t("compare.top14Reached")} style={{ color: T14_COL, marginLeft: 3 }}>★</span>}</td>
                  <td style={{ ...tdR, color: dCol, fontWeight: 800 }}>{deltaStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barres comparatives (% du seuil Top 14) */}
      <div style={sc({ marginBottom: 12 })}>
        <SectionTitle>{t("compare.barsTitle")}</SectionTitle>
        {TOP14_TESTS.map((tst) => (
          <BarRow key={tst.key} label={t("data.top14test." + tst.key)} a={A.byTest[tst.key]?.pct} b={B.byTest[tst.key]?.pct} />
        ))}
        <Legend aLabel={headTitle(A)} bLabel={headTitle(B)} />
      </div>

      {/* Radar */}
      <div style={sc({ display: "flex", flexDirection: "column", alignItems: "center" })}>
        <SectionTitle>{t("compare.radarTitle")}</SectionTitle>
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
  const { t } = useTranslation();
  const title = headTitle(data);
  const sub = data.isAverage ? t("compare.average", { count: data.members }) : catLabel(data.cat);
  const dateLabel = data.lastDate
    ? t(data.isAverage ? "compare.updated" : "compare.testedOn", { date: fmtShort(data.lastDate) })
    : t(data.isAverage ? "compare.noData" : "compare.noTest");
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}55`, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: 1 }}>{tag}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{sub}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
        <span style={{ color: T14_COL, fontWeight: 800 }}>{data.count}/9</span> {t("compare.top14")} · {dateLabel}
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
  const { t } = useTranslation();
  const dot = (c, l) => (<span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "rgba(255,255,255,0.6)", maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0 }} />{l}</span>);
  return <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>{dot(A_COL, aLabel)}{dot(B_COL, bLabel)}{dot(T14_COL, t("compare.top14"))}</div>;
}

function Radar({ a, b }) {
  const { t } = useTranslation();
  const size = 280, c = size / 2, R = c - 34, MAXN = 1.5;
  const axes = TOP14_TESTS;
  const ang = (i) => (-90 + i * (360 / axes.length)) * (Math.PI / 180);
  const pt = (norm, i) => {
    const r = R * Math.max(0, Math.min(MAXN, norm)) / MAXN;
    return [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  };
  const ring = (norm) => axes.map((_, i) => pt(norm, i).join(",")).join(" ");
  const poly = (data) => axes.map((tst, i) => pt((data.byTest[tst.key]?.pct ?? 0) / 100, i).join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: "100%" }}>
      {[0.5, 1.5].map((n) => <polygon key={n} points={ring(n)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />)}
      <polygon points={ring(1)} fill="none" stroke={T14_COL} strokeWidth="1.5" strokeDasharray="4 4" />
      {axes.map((tst, i) => { const [x, y] = pt(MAXN, i); return <line key={tst.key} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />; })}
      <polygon points={poly(a)} fill={`${A_COL}33`} stroke={A_COL} strokeWidth="2" />
      <polygon points={poly(b)} fill={`${B_COL}33`} stroke={B_COL} strokeWidth="2" />
      {axes.map((tst, i) => {
        const [x, y] = pt(MAXN + 0.18, i);
        return <text key={tst.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fill="rgba(255,255,255,0.6)" fontWeight="700">{t("data.top14test." + tst.key).split(" ")[0]}</text>;
      })}
    </svg>
  );
}
