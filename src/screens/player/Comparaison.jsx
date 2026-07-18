import { C, sc } from "../../lib/tokens.js";
import { grpLabel } from "../../lib/positions.js";
import { useTestCampaigns, useLineStats } from "../../data/tests.js";
import { TOP14_TESTS, TOP14_BENCH, posToCat, datedResultsFor, top14Player } from "../../lib/top14.js";

/* Comparaison « Où je me situe ? » (vue joueur). Pour chaque test : ma valeur,
   la moyenne de ma ligne (avants/arrières) et le repère Top 14, sur une barre où
   « à droite = mieux ». Langage simple, progrès mis en avant.

   Confidentialité : mes propres valeurs viennent de mes résultats (lisibles) ;
   la moyenne de ligne et mon rang viennent d'une fonction SECURITY DEFINER
   (comparison_line_stats) — jamais les valeurs brutes des coéquipiers.
   Réutilise TOP14_TESTS / TOP14_BENCH — aucune formule modifiée. */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const secMMSS = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Les 8 tests demandés (Hang Clean exclu ici), en langage joueur.
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

export default function Comparaison({ me, players }) {
  const { campaigns, results, loading } = useTestCampaigns(me.team);
  const lineStats = useLineStats(me.id); // { [metric]: { avg, n, rank } } — agrégats serveur
  const cat = posToCat(me.pos);
  const bench = cat ? TOP14_BENCH[cat] : null;
  const peers = players.filter((p) => p.grp === me.grp);

  // Mes propres résultats datés (dernier + avant-dernier pour le progrès).
  const myDated = datedResultsFor(campaigns, results, me.id);
  const myLast = myDated.length ? myDated[myDated.length - 1] : null;
  const myPrev = myDated.length >= 2 ? myDated[myDated.length - 2] : null;
  // Compteur officiel X/9 (même logique que la fiche + les points : un test
  // validé au moins une fois compte). 9 tests Top 14 (Hang Clean inclus).
  const t14Count = cat ? top14Player(me.pos, myDated).count : 0;

  const cards = ORDER.map((key) => build(key, { myLast, myPrev, bench, grp: me.grp, stat: lineStats[key] })).filter(Boolean);
  const measured = cards.filter((c) => c.myVal != null);

  // Message positif : meilleur progrès (plus gros gain relatif) depuis le dernier camp.
  const best = measured
    .filter((c) => c.improved === true && c.delta != null)
    .sort((a, b) => Math.abs(b.delta / (b.myVal || 1)) - Math.abs(a.delta / (a.myVal || 1)))[0];

  if (loading && !myLast) {
    return <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Chargement de tes tests…</div>;
  }

  return (
    <div>
      {/* En-tête : une seule question centrale */}
      <div style={sc({ marginBottom: 12, padding: 16 })}>
        <div style={{ fontSize: 19, fontWeight: 900 }}>Où je me situe ?</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
          Comparé aux {peers.length} {grpLabel(me.grp)?.toLowerCase() || "joueurs"} de ton club. La barre : <b style={{ color: "#fff" }}>toi</b>, la moyenne de ta ligne, et le repère Top 14. À droite = mieux.
        </div>
        {best && (
          <div style={{ marginTop: 12, background: `${C.green}1a`, border: `1px solid ${C.green}55`, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: C.green }}>
            {FRIENDLY[best.key].dfmt(best.delta)} {best.sub === "Bronco" ? "au Bronco (plus rapide)" : `en ${FRIENDLY[best.key].label.toLowerCase()} (${best.sub})`} depuis le dernier camp 💪
          </div>
        )}
        {myLast && cat && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 11, background: `${C.amb}18`, border: `1px solid ${C.amb}55`, borderRadius: 10, padding: "10px 12px" }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.amb }}>{t14Count}/9 <span style={{ color: "#fff", fontWeight: 800 }}>tests au niveau Top 14</span></div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
                {t14Count === 0 ? "Continue, tu vas décrocher ton premier repère." : t14Count >= 9 ? "Profil complet Top 14 — exceptionnel ! 🔥" : "Chaque test franchi te rapproche du profil Top 14."}
              </div>
            </div>
          </div>
        )}
      </div>

      {!myLast ? (
        <div style={sc({ textAlign: "center", padding: 26, color: "rgba(255,255,255,0.6)", fontSize: 12.5, lineHeight: 1.6 })}>
          Aucun test enregistré pour l'instant.<br />Tes résultats apparaîtront ici après ta prochaine évaluation physique.
        </div>
      ) : (
        cards.map((c) => <TestCard key={c.key} c={c} />)
      )}
    </div>
  );
}

function build(key, { myLast, myPrev, bench, grp, stat }) {
  const t = testDef[key];
  const f = FRIENDLY[key];
  if (!t || !f) return null;
  const top14 = bench ? bench[key] : null;
  const dir = t.dir; // 'up' | 'down'

  const myVal = myLast ? val(t, myLast) : null;
  const prevVal = myPrev ? val(t, myPrev) : null;
  const delta = myVal != null && prevVal != null ? myVal - prevVal : null;
  const improved = delta == null ? null : dir === "down" ? delta < 0 : delta > 0;

  // Moyenne de ligne + mon rang : agrégats serveur (pas de valeurs coéquipiers).
  const lineAvg = stat?.avg ?? null;
  const rank = stat?.rank ?? null;
  const total = stat?.n ?? null;

  // Couleur : au-dessus de la moyenne = vert, proche (±5 %) = ambre, en dessous = coral.
  const reachedTop14 = top14 != null && myVal != null && (dir === "down" ? myVal <= top14 : myVal >= top14);
  let color = C.gray;
  if (reachedTop14) color = C.green;
  else if (lineAvg != null && myVal != null) {
    const rel = (dir === "down" ? lineAvg - myVal : myVal - lineAvg) / (Math.abs(lineAvg) || 1);
    color = rel > 0.05 ? C.green : rel >= -0.05 ? C.amb : C.coral;
  }

  return { key, label: f.label, sub: f.sub, fmt: f.fmt, dir, myVal, delta, improved, lineAvg, top14, rank, total, color, reachedTop14, grp };
}

// Valeur comparable d'un test (×PdC pour la force via bodyweight ; brut sinon).
function val(t, r) {
  const v = t.from(r, r?.bodyweight != null ? Number(r.bodyweight) : null);
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function TestCard({ c }) {
  const { fmt, myVal, lineAvg, top14, dir } = c;
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
  const myPos = pos(myVal), avgPos = pos(lineAvg), t14Pos = pos(top14);

  if (myVal == null) {
    return (
      <div style={sc({ marginBottom: 10, padding: 14 })}>
        <Head c={c} />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>Pas encore mesuré.</div>
      </div>
    );
  }

  return (
    <div style={sc({ marginBottom: 10, padding: 14, borderLeft: `3px solid ${c.color}` })}>
      <Head c={c} />

      {/* Valeur + progrès */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: c.color }}>{fmt(myVal)}</span>
        {c.delta != null && Math.abs(c.delta) > 1e-9 && (
          <span style={{ fontSize: 12, fontWeight: 800, color: c.improved ? C.green : C.coral }}>
            {c.improved ? "▲" : "▼"} {FRIENDLY[c.key].dfmt(c.delta)} <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>depuis le dernier camp</span>
          </span>
        )}
      </div>

      {/* Barre : toi / moyenne ligne / Top 14 */}
      <div style={{ position: "relative", height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, marginBottom: 8 }}>
        {avgPos != null && (
          <div style={{ position: "absolute", left: `${avgPos}%`, top: -3, width: 2, height: 16, background: "rgba(255,255,255,0.55)" }} title="Moyenne de ta ligne" />
        )}
        {t14Pos != null && (
          <div style={{ position: "absolute", left: `calc(${t14Pos}% - 1px)`, top: -6, display: "flex", flexDirection: "column", alignItems: "center" }} title="Repère Top 14">
            <span style={{ fontSize: 9 }}>🏆</span>
            <div style={{ width: 2, height: 13, background: C.amb }} />
          </div>
        )}
        <div style={{ position: "absolute", left: `calc(${myPos}% - 8px)`, top: -4, width: 18, height: 18, borderRadius: 9, background: c.color, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} title="Toi" />
      </div>

      {/* Légende chiffrée */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
        <span style={{ color: c.color, fontWeight: 800 }}>Toi {fmt(myVal)}</span>
        <span style={{ color: "rgba(255,255,255,0.6)" }}>Ligne {lineAvg != null ? fmt(lineAvg) : "—"}</span>
        <span style={{ color: C.amb, fontWeight: 700 }}>Top 14 {top14 != null ? fmt(top14) : "—"}</span>
      </div>
    </div>
  );
}

function Head({ c }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{c.label} <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>· {c.sub}</span></div>
      </div>
      {c.reachedTop14 && <span style={{ fontSize: 9, fontWeight: 800, color: "#0c2b2b", background: C.amb, borderRadius: 5, padding: "2px 6px" }}>🏆 TOP 14</span>}
      {c.rank != null && c.total > 0 && (
        <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
          {c.rank}ᵉ / {c.total} {grpLabel(c.grp)?.toLowerCase() || ""}
        </span>
      )}
    </div>
  );
}
