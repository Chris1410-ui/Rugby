import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { useTestCampaigns, useLineStats } from "../../data/tests.js";
import { TOP14_TESTS, TOP14_BENCH, posToCat, datedResultsFor, top14Player, withCurrentBodyweight, currentValueForTest } from "../../lib/top14.js";

/* Comparaison « Où je me situe ? » (vue joueur). Pour CHAQUE test : ma valeur,
   la moyenne de ma ligne et le repère Top 14 sur une même barre (« à droite =
   mieux »), avec des libellés de position explicites (au-dessus/sous ma ligne,
   mon rang, distance au seuil Top 14). Récap visuel en tête. Tests non mesurés
   compactés en bas.

   Confidentialité : mes valeurs viennent de mes résultats ; la moyenne de ligne
   et mon rang d'une fonction SECURITY DEFINER (comparison_line_stats, moyenne
   par métrique) — jamais les valeurs brutes des coéquipiers. */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const secMMSS = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Les 8 tests (Hang Clean exclu ici), en langage joueur.
const FRIENDLY = {
  mas:       { label: "Ta vitesse",     sub: "MAS",              fmt: (v) => `${v.toFixed(1)} m/s`, dfmt: (d) => `${d > 0 ? "+" : ""}${d.toFixed(1)} m/s` },
  yoyo:      { label: "Ton cardio",     sub: "Yo-Yo",            fmt: (v) => `${Math.round(v)} m`,  dfmt: (d) => `${d > 0 ? "+" : ""}${Math.round(d)} m` },
  bronco:    { label: "Ton endurance",  sub: "Bronco",           fmt: (v) => secMMSS(v),            dfmt: (d) => `${d > 0 ? "+" : ""}${Math.round(d)} s` },
  cmj:       { label: "Ta détente",     sub: "CMJ",              fmt: (v) => `${Math.round(v)} cm`, dfmt: (d) => `${d > 0 ? "+" : ""}${Math.round(d)} cm` },
  squat:     { label: "Ta force",       sub: "Squat",            fmt: (v) => `${v.toFixed(2)}×`,    dfmt: (d) => `${d > 0 ? "+" : ""}${d.toFixed(2)}×` },
  bench:     { label: "Ta force",       sub: "Développé couché", fmt: (v) => `${v.toFixed(2)}×`,    dfmt: (d) => `${d > 0 ? "+" : ""}${d.toFixed(2)}×` },
  deadlift:  { label: "Ta force",       sub: "Soulevé de terre", fmt: (v) => `${v.toFixed(2)}×`,    dfmt: (d) => `${d > 0 ? "+" : ""}${d.toFixed(2)}×` },
  tractions: { label: "Ton tirage",     sub: "Tractions",        fmt: (v) => `${v.toFixed(2)}×`,    dfmt: (d) => `${d > 0 ? "+" : ""}${d.toFixed(2)}×` },
};
const ORDER = ["mas", "yoyo", "bronco", "cmj", "squat", "bench", "deadlift", "tractions"];
const testDef = Object.fromEntries(TOP14_TESTS.map((t) => [t.key, t]));

// Magnitude d'un écart, formatée par test (pour les libellés de position).
const magOf = (key, v) => (key === "bronco" ? `${Math.round(Math.abs(v))} s` : FRIENDLY[key].fmt(Math.abs(v)));

export default function Comparaison({ me, players }) {
  const { campaigns, results, loading } = useTestCampaigns(me.team);
  const lineStats = useLineStats(me.id); // { [metric]: { avg, n, rank } } — agrégats serveur
  const cat = posToCat(me.pos);
  const bench = cat ? TOP14_BENCH[cat] : null;
  const peers = players.filter((p) => p.grp === me.grp);

  // Mes résultats datés (le dernier porte mon poids courant → ×PdC à jour).
  const myDated = withCurrentBodyweight(me, datedResultsFor(campaigns, results, me.id));
  const myLast = myDated.length ? myDated[myDated.length - 1] : null;
  const myPrev = myDated.length >= 2 ? myDated[myDated.length - 2] : null;
  const t14Count = cat ? top14Player(me.pos, myDated).count : 0;

  const all = ORDER.map((key) => build(key, { myDated, myLast, myPrev, bench, grp: me.grp, stat: lineStats[key] })).filter(Boolean);
  // Mesurés en haut, triés par performance relative à la ligne (mes forces d'abord).
  const measured = all.filter((c) => c.myVal != null).sort((a, b) => (b.relPct ?? -999) - (a.relPct ?? -999));
  const todo = all.filter((c) => c.myVal == null);

  // Récap : au-dessus / au niveau / sous ma ligne (parmi les tests avec ligne).
  const withLine = measured.filter((c) => c.lineShown);
  const above = withLine.filter((c) => c.vsLine === "up").length;
  const atLine = withLine.filter((c) => c.vsLine === "at").length;
  const below = withLine.filter((c) => c.vsLine === "down").length;

  // Meilleur progrès depuis le dernier camp.
  const best = measured
    .filter((c) => c.improved === true && c.delta != null)
    .sort((a, b) => Math.abs(b.delta / (b.myVal || 1)) - Math.abs(a.delta / (a.myVal || 1)))[0];

  if (loading && !myLast) {
    return <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Chargement de tes tests…</div>;
  }

  return (
    <div>
      {/* En-tête + récap visuel */}
      <div style={sc({ marginBottom: 12, padding: 16 })}>
        <div style={{ fontSize: 19, fontWeight: 900 }}>Où je me situe ?</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
          Comparé aux {peers.length} {grpLabel(me.grp)?.toLowerCase() || "joueurs"} de ton club. Sur chaque barre : <b style={{ color: "#fff" }}>toi</b>, la moyenne de ta ligne, le repère Top 14. À droite = mieux.
        </div>

        {myLast && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
              <RecapTile label="AU-DESSUS DE TA LIGNE" value={above} color={C.green} />
              <RecapTile label="SOUS TA LIGNE" value={below} color={C.coral} />
              <RecapTile label="NIVEAU TOP 14" value={`${t14Count}/9`} color={C.amb} />
            </div>
            {withLine.length > 0 && (
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10, background: "rgba(255,255,255,0.06)" }}>
                <div style={{ width: `${(above / withLine.length) * 100}%`, background: C.green }} />
                <div style={{ width: `${(atLine / withLine.length) * 100}%`, background: C.amb }} />
                <div style={{ width: `${(below / withLine.length) * 100}%`, background: C.coral }} />
              </div>
            )}
          </>
        )}

        {best && (
          <div style={{ marginTop: 12, background: `${C.green}1a`, border: `1px solid ${C.green}55`, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: C.green }}>
            {FRIENDLY[best.key].dfmt(best.delta)} {best.sub === "Bronco" ? "au Bronco (plus rapide)" : `en ${FRIENDLY[best.key].label.toLowerCase()} (${best.sub})`} depuis le dernier camp 💪
          </div>
        )}
      </div>

      {!myLast ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          Aucun test enregistré pour l'instant.<br />Tes résultats apparaîtront ici après ta prochaine évaluation physique.
        </div>
      ) : (
        <>
          {measured.map((c) => <TestCard key={c.key} c={c} />)}
          {todo.length > 0 && <TodoList items={todo} />}
        </>
      )}
    </div>
  );
}

function build(key, { myDated, myPrev, bench, grp, stat }) {
  const t = testDef[key];
  const f = FRIENDLY[key];
  if (!t || !f) return null;
  const top14 = bench ? bench[key] : null;
  const dir = t.dir; // 'up' | 'down'

  // Valeur courante = dernière valeur non nulle (force ÷ poids courant) → le ×PdC
  // s'affiche dès que la charge et le poids existent, même si mesurés à des dates
  // différentes. Le « précédent » sert uniquement au delta de progression.
  const myVal = currentValueForTest(t, myDated);
  const prevVal = myPrev ? val(t, myPrev) : null;
  const delta = myVal != null && prevVal != null ? myVal - prevVal : null;
  const improved = delta == null ? null : dir === "down" ? delta < 0 : delta > 0;

  // Moyenne + rang de ligne (agrégats serveur). Affichée dès qu'un coéquipier a
  // la donnée → total ≥ 2 (moi + au moins un autre).
  const lineAvg = stat?.avg ?? null;
  const rank = stat?.rank ?? null;
  const total = stat?.n ?? null;
  const lineShown = lineAvg != null && total >= 2;

  const reachedTop14 = top14 != null && myVal != null && (dir === "down" ? myVal <= top14 : myVal >= top14);

  // Position vs ligne (sens correct pour le Bronco : plus bas = mieux).
  let vsLine = null, relPct = null, rawLineDelta = null;
  if (lineShown && myVal != null) {
    rawLineDelta = myVal - lineAvg;
    relPct = ((dir === "down" ? lineAvg - myVal : myVal - lineAvg) / (Math.abs(lineAvg) || 1)) * 100;
    vsLine = Math.abs(relPct) < 2 ? "at" : relPct > 0 ? "up" : "down";
  }

  let color = C.gray;
  if (reachedTop14) color = C.green;
  else if (vsLine === "up") color = C.green;
  else if (vsLine === "at") color = C.amb;
  else if (vsLine === "down") color = C.coral;

  const gapT14 = top14 != null && myVal != null ? myVal - top14 : null;

  return { key, label: f.label, sub: f.sub, fmt: f.fmt, dir, myVal, delta, improved, lineAvg, top14, rank, total, color, reachedTop14, grp, lineShown, vsLine, relPct, rawLineDelta, gapT14 };
}

// Valeur comparable d'un test (×PdC via bodyweight ; brut sinon).
function val(t, r) {
  const v = t.from(r, r?.bodyweight != null ? Number(r.bodyweight) : null);
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function RecapTile({ label, value, color }) {
  return (
    <div style={{ background: `${color}16`, border: `1px solid ${color}44`, borderRadius: 10, padding: "9px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.4, marginTop: 4, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

function TestCard({ c }) {
  const { fmt, myVal, lineAvg, top14, dir, key } = c;
  // Domaine de la barre (avec marge) ; « à droite = mieux » (axe inversé si down).
  const pts = [myVal, lineAvg, top14].filter((v) => v != null && Number.isFinite(v));
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.12 || 1;
  const dMin = Math.max(0, lo - pad), dMax = hi + pad;
  const pos = (v) => {
    if (v == null || !Number.isFinite(v) || dMax === dMin) return null;
    const raw = ((v - dMin) / (dMax - dMin)) * 100;
    return clamp(dir === "down" ? 100 - raw : raw, 0, 100);
  };
  const myPos = pos(myVal), avgPos = c.lineShown ? pos(lineAvg) : null, t14Pos = pos(top14);

  // Libellés de position.
  const better = c.vsLine === "up";
  const lineLabel = !c.lineShown ? null
    : c.vsLine === "at" ? "au niveau de ta ligne"
    : `${magOf(key, c.rawLineDelta)} ${better ? "au-dessus" : "sous"} de ta ligne`;
  const rankLabel = c.rank != null && c.total >= 2 ? `${c.rank}ᵉ des ${c.total} ${grpLabel(c.grp)?.toLowerCase() || "joueurs"}` : null;
  const t14Label = c.reachedTop14 ? "✓ seuil Top 14 atteint"
    : (top14 != null && myVal != null ? `à ${magOf(key, c.gapT14)} du seuil Top 14` : null);

  return (
    <div style={sc({ marginBottom: 10, padding: 14, borderLeft: `3px solid ${c.color}` })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{c.label} <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>· {c.sub}</span></div>
        </div>
        {c.reachedTop14 && <span style={{ fontSize: 9, fontWeight: 800, color: "#0c2b2b", background: C.amb, borderRadius: 5, padding: "2px 6px" }}>🏆 TOP 14</span>}
        {rankLabel && <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>{rankLabel}</span>}
      </div>

      {/* Valeur + progrès */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: c.color }}>{fmt(myVal)}</span>
        {c.delta != null && Math.abs(c.delta) > 1e-9 && (
          <span style={{ fontSize: 12, fontWeight: 800, color: c.improved ? C.green : C.coral }}>
            {c.improved ? "▲" : "▼"} {FRIENDLY[key].dfmt(c.delta)} <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>depuis le dernier camp</span>
          </span>
        )}
      </div>

      {/* Barre : toi / moyenne ligne / Top 14 */}
      <div style={{ position: "relative", height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, marginBottom: 8 }}>
        {avgPos != null && (
          <div style={{ position: "absolute", left: `${avgPos}%`, top: -3, width: 2, height: 16, background: "rgba(255,255,255,0.65)" }} title="Moyenne de ta ligne" />
        )}
        {t14Pos != null && (
          <div style={{ position: "absolute", left: `calc(${t14Pos}% - 1px)`, top: -6, display: "flex", flexDirection: "column", alignItems: "center" }} title="Repère Top 14">
            <span style={{ fontSize: 9 }}>🏆</span>
            <div style={{ width: 2, height: 13, background: C.amb }} />
          </div>
        )}
        <div style={{ position: "absolute", left: `calc(${myPos}% - 8px)`, top: -4, width: 18, height: 18, borderRadius: 9, background: c.color, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} title="Toi" />
      </div>

      {/* Libellés de position explicites */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {lineLabel && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c.vsLine === "up" ? C.green : c.vsLine === "down" ? C.coral : C.amb, background: `${c.vsLine === "up" ? C.green : c.vsLine === "down" ? C.coral : C.amb}18`, borderRadius: 6, padding: "3px 8px" }}>{lineLabel}</span>
        )}
        {!c.lineShown && (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "3px 8px" }}>ta ligne pas encore mesurée</span>
        )}
        {t14Label && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c.reachedTop14 ? C.green : C.amb, background: `${c.reachedTop14 ? C.green : C.amb}18`, borderRadius: 6, padding: "3px 8px" }}>{t14Label}</span>
        )}
      </div>
    </div>
  );
}

// Tests non encore mesurés : compactés en petites puces grisées.
function TodoList({ items }) {
  return (
    <div style={sc({ padding: "11px 14px" })}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 8 }}>À MESURER · {items.length}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((c) => (
          <span key={c.key} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 9px" }}>
            {c.label} <span style={{ color: "rgba(255,255,255,0.3)" }}>· {c.sub}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
