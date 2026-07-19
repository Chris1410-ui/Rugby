import { TOP14_TESTS, datedResultsFor, top14Player, withCurrentBodyweight, posToCat, evalTest } from "./top14.js";

/* Construction des PROFILS de comparaison (source unique, partagée staff/joueur).
   Un profil = forme rendue à l'identique par CompareView (tableau / barres / radar) :
     { label?, player?, isAverage, cat, members?, count, lastDate,
       byTest: { [test]: { value, pct, valid } } }

   Trois fabriques selon la source de données (et donc la confidentialité) :
   - analyzeProfile        : UN joueur (le staff, ou « Toi » côté joueur) — client.
   - averageProfileClient  : moyenne équipe/ligne calculée CÔTÉ CLIENT (staff, qui
                             lit tous les résultats de l'équipe via RLS).
   - profileFromStats      : moyenne équipe/ligne depuis les AGRÉGATS SERVEUR
                             (joueur : la RLS ne lui donne que ses propres résultats
                             → jamais de valeur brute d'un coéquipier). */

// Un joueur : dernier résultat daté + évaluation Top 14 par test (au poids courant).
export function analyzeProfile(player, campaigns, results, label) {
  if (!player) return null;
  const raw = datedResultsFor(campaigns, results, player.id);
  const latest = raw.length ? raw[raw.length - 1] : null;
  const dated = withCurrentBodyweight(player, raw);
  const t14 = top14Player(player.pos, dated);
  return { player, label, isAverage: false, cat: t14.cat, byTest: t14.byTest, count: t14.count, lastDate: latest?.date || null };
}

/* Profil MOYEN (équipe ou ligne) calculé côté client : pour chaque test, moyenne
   de la DERNIÈRE valeur non nulle de chaque joueur du groupe ; le % de seuil Top 14
   est moyenné par joueur (chacun jugé face à SON propre seuil). Réservé au staff
   (accès à tous les résultats). */
export function averageProfileClient(members, campaigns, results, label) {
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

/* Profil MOYEN depuis les agrégats serveur (joueur). `statsMap` =
   { [metric]: { value, pct, n, rank } } fourni par comparison_line_stats /
   comparison_team_stats. `avg_pct` (serveur) = miroir exact d'averageProfileClient. */
export function profileFromStats(label, statsMap) {
  const byTest = {};
  let members = 0;
  TOP14_TESTS.forEach((t) => {
    const s = statsMap?.[t.key];
    const pct = s?.pct ?? null;
    byTest[t.key] = { key: t.key, value: s?.value ?? null, pct, valid: pct != null && pct >= 100 };
    if (s?.n) members = Math.max(members, s.n);
  });
  const count = TOP14_TESTS.filter((t) => byTest[t.key].valid).length;
  return { isAverage: true, label, members, cat: null, byTest, count, lastDate: null };
}
