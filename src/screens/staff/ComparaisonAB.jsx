import { useMemo, useState } from "react";
import { C, sc } from "../../lib/tokens.js";
import { displayName } from "../../lib/identity.js";
import { fmtShort } from "../../lib/metrics.js";
import { grpLabel } from "../../lib/positions.js";
import { useTestCampaigns } from "../../data/tests.js";
import { TOP14_TESTS, catLabel, datedResultsFor, top14Player, withCurrentBodyweight, posToCat, evalTest } from "../../lib/top14.js";
import { Activity } from "../../lib/icons.jsx";

const B_TEAM = "__team__", B_LINE = "__line__";

/* Comparaison A/B (staff) : deux joueurs côte à côte sur les 9 tests physiques,
   écarts, barres comparatives et radar, le tout référencé au Top 14 par poste.
   Chaque joueur est jugé face à SON propre seuil (posToCat) ; les barres/radar
   sont normalisés en % du seuil Top 14 → une échelle commune où 100 % = Top 14. */

const DEC = { squat: 2, bench: 2, deadlift: 2, hangclean: 2, tractions: 2, mas: 2, yoyo: 0, cmj: 0 };
const A_COL = C.green, B_COL = C.viol, T14_COL = "#F2C84B";

function fmtVal(key, v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (key === "bronco") return `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  return v.toFixed(DEC[key] ?? 1);
}

// Analyse un joueur : dernier résultat daté + évaluation Top 14 par test.
function analyze(player, campaigns, results) {
  if (!player) return null;
  const raw = datedResultsFor(campaigns, results, player.id);
  const latest = raw.length ? raw[raw.length - 1] : null;
  // Poids « courant » (dernier test OU questionnaire) pour les valeurs ×PdC.
  const dated = withCurrentBodyweight(player, raw);
  const t14 = top14Player(player.pos, dated);
  return { player, cat: t14.cat, byTest: t14.byTest, count: t14.count, lastDate: latest?.date || null };
}

/* Profil MOYEN (équipe ou ligne) : pour chaque test, moyenne de la DERNIÈRE
   valeur non nulle de chaque joueur du groupe (même logique que la migration
   0041). Le % de seuil Top 14 est moyenné par joueur (chacun jugé face à SON
   propre seuil) → échelle commune pour les barres/radar. Renvoie la même forme
   que analyze() (byTest / count / lastDate) pour être rendu à l'identique. */
function averageProfile(members, campaigns, results, label) {
  const acc = {};
  TOP14_TESTS.forEach((t) => { acc[t.key] = { vals: [], pcts: [] }; });
  const dates = [];
  let contributors = 0;
  for (const p of members) {
    const dated = datedResultsFor(campaigns, results, p.id);
    if (!dated.length) continue;
    const cat = posToCat(p.pos);
    let used = false;
    for (const t of TOP14_TESTS) {
      let hit = null;
      for (let i = dated.length - 1; i >= 0; i--) {
        const r = dated[i];
        const v = t.from(r, r.bodyweight != null ? Number(r.bodyweight) : null);
        if (v != null && Number.isFinite(v) && v > 0) { hit = r; break; }
      }
      if (!hit) continue;
      used = true;
      acc[t.key].vals.push(t.from(hit, hit.bodyweight != null ? Number(hit.bodyweight) : null));
      if (cat) { const e = evalTest(t, hit, cat); if (e.pct != null) acc[t.key].pcts.push(e.pct); }
      if (hit.date) dates.push(hit.date);
    }
    if (used) contributors++;
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const byTest = {};
  TOP14_TESTS.forEach((t) => {
    const pct = mean(acc[t.key].pcts);
    byTest[t.key] = { key: t.key, value: mean(acc[t.key].vals), pct, valid: pct != null && pct >= 100 };
  });
  const count = TOP14_TESTS.filter((t) => byTest[t.key].valid).length;
  const lastDate = dates.length ? dates.slice().sort()[dates.length - 1] : null;
  return { isAverage: true, label, members: contributors, cat: null, byTest, count, lastDate };
}

export default function ComparaisonAB({ teamId, players }) {
  const { campaigns, results } = useTestCampaigns(teamId);
  const roster = useMemo(
    () => [...players].sort((a, b) => displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base" })),
    [players],
  );
  const realPlayers = useMemo(() => players.filter((p) => !p.isDemo), [players]);
  const [aId, setAId] = useState(roster[0]?.id || "");
  const [bId, setBId] = useState(B_TEAM);

  const A = useMemo(() => analyze(roster.find((p) => p.id === aId), campaigns, results), [roster, aId, campaigns, results]);
  const B = useMemo(() => {
    if (bId === B_TEAM) return averageProfile(realPlayers, campaigns, results, "Moyenne équipe");
    if (bId === B_LINE) {
      const grp = A?.player?.grp;
      return averageProfile(realPlayers.filter((p) => p.grp === grp), campaigns, results, `Moyenne ${grpLabel(grp)?.toLowerCase() || "ligne"}`);
    }
    return analyze(roster.find((p) => p.id === bId), campaigns, results);
  }, [bId, roster, realPlayers, campaigns, results, A]);
  const bIsAvg = bId === B_TEAM || bId === B_LINE;
  const swap = () => { if (bIsAvg) return; setAId(bId); setBId(aId); };

  const sel = { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none" };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Activity size={18} color={C.coral} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>Comparaison A/B</div>
      </div>

      {/* Sélecteurs A ⇄ B */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <select value={aId} onChange={(e) => setAId(e.target.value)} style={{ ...sel, borderColor: `${A_COL}88` }}>
          {roster.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
        </select>
        <button onClick={swap} disabled={bIsAvg} title={bIsAvg ? "Échange indisponible avec une moyenne" : "Échanger A et B"} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: bIsAvg ? "default" : "pointer", flexShrink: 0, opacity: bIsAvg ? 0.4 : 1 }}>⇄</button>
        <select value={bId} onChange={(e) => setBId(e.target.value)} style={{ ...sel, borderColor: `${B_COL}88` }}>
          <optgroup label="Moyennes">
            <option value={B_TEAM}>Moyenne équipe</option>
            <option value={B_LINE}>Moyenne de la ligne de A</option>
          </optgroup>
          <optgroup label="Joueurs">
            {roster.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </optgroup>
        </select>
      </div>

      {(!A || !B) ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5 })}>Choisis deux joueurs à comparer.</div>
      ) : (
        <>
          {/* Cartouches identité */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <PlayerHead a data={A} color={A_COL} />
            <PlayerHead data={B} color={B_COL} />
          </div>

          {/* Tableau des tests */}
          <div style={sc({ padding: 0, overflow: "hidden", marginBottom: 12 })}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th style={thL}>Test</th>
                  <th style={{ ...thR, color: A_COL }}>A</th>
                  <th style={{ ...thR, color: B_COL }}>B</th>
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

          {/* Barres comparatives (normalisées en % du seuil Top 14) */}
          <div style={sc({ marginBottom: 12 })}>
            <SectionTitle>Barres · % du seuil Top 14 (100 % = Top 14)</SectionTitle>
            {TOP14_TESTS.map((t) => (
              <BarRow key={t.key} label={t.label} a={A.byTest[t.key]?.pct} b={B.byTest[t.key]?.pct} />
            ))}
            <Legend aLabel={A.isAverage ? A.label : displayName(A.player)} bLabel={B.isAverage ? B.label : displayName(B.player)} />
          </div>

          {/* Radar */}
          <div style={sc({ display: "flex", flexDirection: "column", alignItems: "center" })}>
            <SectionTitle>Radar · profil physique (repère Top 14)</SectionTitle>
            <Radar a={A} b={B} />
            <Legend aLabel={A.isAverage ? A.label : displayName(A.player)} bLabel={B.isAverage ? B.label : displayName(B.player)} />
          </div>
        </>
      )}
    </section>
  );
}

const thL = { textAlign: "left", padding: "9px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 };
const thR = { textAlign: "right", padding: "9px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 };
const tdL = { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "rgba(255,255,255,0.8)" };
const tdR = { textAlign: "right", padding: "8px 10px", fontVariantNumeric: "tabular-nums" };

function SectionTitle({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 10, alignSelf: "flex-start" }}>{children}</div>;
}

function PlayerHead({ data, color, a }) {
  const title = data.isAverage ? data.label : displayName(data.player);
  const sub = data.isAverage ? `moyenne · ${data.members} joueur${data.members > 1 ? "s" : ""}` : catLabel(data.cat);
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}55`, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: 1 }}>{a ? "A" : "B"}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{sub}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
        <span style={{ color: T14_COL, fontWeight: 800 }}>{data.count}/9</span> Top 14 · {data.lastDate ? `${data.isAverage ? "MàJ" : "test"} ${fmtShort(data.lastDate)}` : (data.isAverage ? "aucune donnée" : "aucun test")}
      </div>
    </div>
  );
}

// Barre : deux segments (A, B) dont la largeur = pct/150 (Top 14 = repère à 66,7 %).
function BarRow({ label, a, b }) {
  const MAX = 150; // % affiché en pleine largeur
  const w = (v) => (v == null ? 0 : Math.max(0, Math.min(100, (v / MAX) * 100)));
  const t14 = (100 / MAX) * 100; // position du repère Top 14
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

// Radar SVG : 9 axes, valeurs normalisées (pct/100), anneau Top 14 = 1.0.
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
