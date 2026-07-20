/* ════════════════════════════════════════════════════════════════
   top14.js — normes seniors « Top 14 » PAR POSTE + comparaison joueur.

   ⚠️ VALEURS ÉDITABLES : la table TOP14_BENCH ci-dessous reprend EXACTEMENT
   les seuils fournis (normes seniors, volontairement exigeantes). Le seuil =
   borne basse de la fourchette. Modifie librement les nombres ici.

   Table de référence (borne basse) :
     Poste (n°)            Squat  Bench  Deadlift  HangCln  Tractions  MAS   Bronco   Yo-Yo   CMJ
     1re ligne (1,2,3)     1.70   1.30   1.95      1.00     +0.25      4.3   ≤5:30    ≥1400   ≥32
     2e ligne (4,5)        1.65   1.15   1.90      1.00     +0.30      4.4   ≤5:20    ≥1500   ≥34
     3e ligne (6,7,8)      1.75   1.30   2.00      1.10     +0.37      4.7   ≤5:05    ≥1800   ≥38
     Charnière (9,10)      1.75   1.30   2.10      1.15     +0.40      4.9   ≤4:45    ≥2000   ≥40
     Centres (12,13)       1.75   1.35   2.05      1.15     +0.42      4.7   ≤4:50    ≥1900   ≥40
     Triangle arr.(11,14,15)1.70  1.30   2.05      1.15     +0.43      5.0   ≤4:45    ≥2000   ≥42
   (Squat/Bench/Deadlift/HangClean/Tractions en ×PdC ; MAS en m/s ; Bronco en
    secondes ; Yo-Yo en m ; CMJ en cm.)
   ════════════════════════════════════════════════════════════════ */

import i18n from "../i18n/config.js";

// Seuils EXACTS (Bronco converti en secondes : 5:30=330, 5:20=320, 5:05=305,
// 4:45=285, 4:50=290). hangclean = ×PdC ; mas = m/s.
export const TOP14_BENCH = {
  premiere:  { label: "1re ligne (1,2,3)",         squat: 1.70, bench: 1.30, deadlift: 1.95, hangclean: 1.00, tractions: 0.25, mas: 4.3, bronco: 330, yoyo: 1400, cmj: 32 },
  deuxieme:  { label: "2e ligne (4,5)",            squat: 1.65, bench: 1.15, deadlift: 1.90, hangclean: 1.00, tractions: 0.30, mas: 4.4, bronco: 320, yoyo: 1500, cmj: 34 },
  troisieme: { label: "3e ligne (6,7,8)",          squat: 1.75, bench: 1.30, deadlift: 2.00, hangclean: 1.10, tractions: 0.37, mas: 4.7, bronco: 305, yoyo: 1800, cmj: 38 },
  charniere: { label: "Charnière (9,10)",          squat: 1.75, bench: 1.30, deadlift: 2.10, hangclean: 1.15, tractions: 0.40, mas: 4.9, bronco: 285, yoyo: 2000, cmj: 40 },
  centres:   { label: "Centres (12,13)",           squat: 1.75, bench: 1.35, deadlift: 2.05, hangclean: 1.15, tractions: 0.42, mas: 4.7, bronco: 290, yoyo: 1900, cmj: 40 },
  triangle:  { label: "Triangle arrière (11,14,15)", squat: 1.70, bench: 1.30, deadlift: 2.05, hangclean: 1.15, tractions: 0.43, mas: 5.0, bronco: 285, yoyo: 2000, cmj: 42 },
};

// Poste app (players.pos, ancien OU nouveau libellé) → catégorie Top 14.
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function posToCat(pos) {
  const p = norm(pos);
  if (/pilier|talonneur/.test(p)) return "premiere";
  if (/deuxieme|2e ligne|2eme ligne/.test(p)) return "deuxieme";
  if (/troisieme|flanker|3e ligne|n°8|no8|\bn8\b|\b8\b/.test(p)) return "troisieme";
  if (/demi|melee|ouverture|charniere/.test(p)) return "charniere";
  if (/centre/.test(p)) return "centres";
  if (/ailier|arriere|triangle/.test(p)) return "triangle";
  return null;
}
export const catLabel = (cat) => (TOP14_BENCH[cat] ? i18n.t(`data.top14cat.${cat}`) : "—");

// Helpers de parsing (données saisies).
const numOrNull = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
export const parseKg = (s) => { if (s == null) return null; const m = String(s).match(/[\d.,]+/g); if (!m) return null; return numOrNull(m[m.length - 1]); }; // « 3x170 » → 170
export const broncoToSec = (s) => {
  if (s == null || s === "") return null;
  const m = String(s).match(/(\d+)\s*[:'′]\s*(\d+)/); // m:ss ou m'ss
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = numOrNull(s);
  return n == null ? null : (n < 20 ? Math.round(n * 60) : n); // repli : « 5 » → 300 s
};

// Les 9 tests : comment extraire la valeur joueur d'un résultat (+ poids de corps).
// Squat/Bench/Deadlift/Hang Clean/Tractions dérivés en ×PdC depuis le kg saisi ;
// MAS en m/s ; Bronco en secondes ; Yo-Yo en m ; CMJ en cm.
// ×PdC = charge ÷ poids. On EXIGE une charge non nulle ET un poids > 0, sinon
// null. (Sans le garde-fou, parseKg(null)/bw vaudrait 0 en JS — pas null — et
// masquerait une charge mesurée lors d'une campagne antérieure.)
const perBw = (kg, bw) => (bw > 0 && kg != null ? kg / bw : null);
export const TOP14_TESTS = [
  { key: "squat",     label: "Squat 5RM",      unit: "×PdC",  dir: "up",   from: (r, bw) => perBw(parseKg(r.squat_5rm), bw) },
  { key: "bench",     label: "Bench 5RM",      unit: "×PdC",  dir: "up",   from: (r, bw) => perBw(numOrNull(r.bench_5rm), bw) },
  { key: "deadlift",  label: "Deadlift",       unit: "×PdC",  dir: "up",   from: (r, bw) => perBw(numOrNull(r.deadlift), bw) },
  { key: "hangclean", label: "Hang Clean 2RM", unit: "×PdC",  dir: "up",   from: (r, bw) => perBw(numOrNull(r.hang_clean_2rm), bw) },
  { key: "tractions", label: "Tractions",      unit: "+×PdC", dir: "up",   from: (r, bw) => perBw(numOrNull(r.tractions), bw) },
  { key: "mas",       label: "MAS",            unit: "m/s",   dir: "up",   from: (r) => numOrNull(r.mas) },
  { key: "bronco",    label: "Bronco",         unit: "",      dir: "down", from: (r) => broncoToSec(r.bronco) },
  { key: "yoyo",      label: "Yo-Yo IR1",      unit: "m",     dir: "up",   from: (r) => numOrNull(r.yoyo) },
  { key: "cmj",       label: "CMJ",            unit: "cm",    dir: "up",   from: (r) => numOrNull(r.cmj_overall) },
];

// Évalue un test pour UN résultat (une campagne). Bronco : valide si ≤ seuil ;
// autres : valide si ≥ seuil. pct = 100 % au niveau Top 14 exact.
export function evalTest(test, result, cat) {
  const thr = TOP14_BENCH[cat]?.[test.key];
  const bw = numOrNull(result?.bodyweight);
  const val = result ? test.from(result, bw) : null;
  if (thr == null || val == null || !Number.isFinite(val) || val <= 0) {
    return { key: test.key, value: (val != null && Number.isFinite(val)) ? val : null, threshold: thr, pct: null, valid: false };
  }
  const pct = test.dir === "down" ? (thr / val) * 100 : (val / thr) * 100;
  const valid = test.dir === "down" ? val <= thr : val >= thr;
  return { key: test.key, value: val, threshold: thr, pct, valid };
}

// Tests exprimés en ×PdC (charge ÷ poids de corps) → nécessitent un poids courant.
const PDC_KEYS = new Set(["squat", "bench", "deadlift", "hangclean", "tractions"]);

// Poids de corps « courant » porté par une liste datée (dernier poids non nul —
// injecté par withCurrentBodyweight sur le dernier résultat). null si absent.
function listBodyweight(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]?.bodyweight;
    if (b != null && Number(b) > 0) return Number(b);
  }
  return null;
}

// Ligne effective pour évaluer un test : pour la force, on impose le poids
// COURANT (le poids n'est pas historisé par test → charge ÷ poids courant).
function rowForTest(t, row, curBw) {
  return PDC_KEYS.has(t.key) && curBw != null ? { ...row, bodyweight: curBw } : row;
}

/* Valeur COURANTE d'un test = sa dernière valeur non nulle (du + récent au +
   ancien), la force étant divisée par le poids de corps courant. Renvoie le
   nombre (×PdC / m·s⁻¹ / s / m / cm) ou null. Garantit que le ratio charge÷poids
   s'affiche dès que la charge ET le poids existent — même si la charge a été
   mesurée lors d'une campagne antérieure à la dernière. */
export function currentValueForTest(t, datedResults) {
  const list = datedResults || [];
  const curBw = listBodyweight(list);
  for (let i = list.length - 1; i >= 0; i--) {
    const bw = PDC_KEYS.has(t.key) ? curBw : null;
    const v = t.from(list[i], bw);
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/* Agrège l'historique d'un joueur (résultats DATÉS, triés du + ancien au + récent)
   pour une catégorie :
   - byTest[key] = { value (dernière valeur non nulle AU POIDS COURANT), everValid,
                     firstDate, threshold, pct, valid }
   - count  = nb de tests validés Top 14 (au moins une fois)
   - events = [{ key, date }] pour le crédit +30 (daté de la 1re validation ;
     `key` = clé du test → l'UI traduit via data.top14test.*)
   La force est évaluée au POIDS COURANT (le poids n'étant pas historisé par test),
   et chaque test prend sa dernière valeur mesurée → le ×PdC apparaît dès que la
   charge et le poids existent. Anti-double-comptage : un test validé ne produit
   qu'UN seul event, daté de sa première campagne franchie. */
export function top14Player(pos, datedResults) {
  const cat = posToCat(pos);
  const byTest = {};
  const events = [];
  let count = 0;
  const list = datedResults || [];
  const curBw = listBodyweight(list);
  TOP14_TESTS.forEach((t) => {
    const thr = cat ? TOP14_BENCH[cat][t.key] : null;
    // Dernière évaluation NON nulle (au poids courant pour la force).
    let latestEval = { key: t.key, value: null, threshold: thr, pct: null, valid: false };
    for (let i = list.length - 1; i >= 0; i--) {
      const e = cat ? evalTest(t, rowForTest(t, list[i], curBw), cat) : null;
      if (e && e.value != null && e.value > 0) { latestEval = e; break; }
    }
    // Première campagne franchie (au poids courant) pour le crédit +30.
    let firstValid = null;
    if (cat) {
      for (let i = 0; i < list.length; i++) {
        if (evalTest(t, rowForTest(t, list[i], curBw), cat).valid) { firstValid = list[i]; break; }
      }
    }
    const everValid = !!firstValid;
    byTest[t.key] = { ...latestEval, everValid, firstDate: firstValid?.date || null };
    if (everValid) { count++; events.push({ key: t.key, date: firstValid.date }); }
  });
  return { cat, byTest, count, events };
}

/* Poids de corps « courant » = le plus récent entre le poids du profil
   (players.bodyweight, alimenté par le questionnaire / la fiche, daté par
   bodyweight_at) et le poids du dernier test daté. Renvoie { value, at, source }
   ou null. Sert de référence pour les valeurs ACTUELLES ×PdC. */
export function currentBodyweight(player, datedResults) {
  const list = datedResults || [];
  const last = list.length ? list[list.length - 1] : null;
  const pw = (player?.bodyweight != null && Number(player.bodyweight) > 0)
    ? { value: Number(player.bodyweight), at: player.bodyweightAt || null, source: "profil" } : null;
  const tw = (last && last.bodyweight != null && Number(last.bodyweight) > 0)
    ? { value: Number(last.bodyweight), at: last.date || null, source: "test" } : null;
  if (!pw) return tw;
  if (!tw) return pw;
  // Profil = timestamptz, test = 'YYYY-MM-DD' → on compare sur le jour.
  const pDay = String(pw.at || "").slice(0, 10);
  return (pDay && tw.at && pDay < tw.at) ? tw : pw; // test strictement plus récent → test, sinon profil
}

/* Renvoie la liste datée où le DERNIER résultat porte le poids « courant »
   (profil OU dernier test, le plus récent). Ainsi les valeurs actuelles ×PdC
   (Top 14 / comparaisons) reflètent le dernier poids connu, sans réécrire
   l'historique (les résultats antérieurs gardent leur propre poids). */
export function withCurrentBodyweight(player, datedResults) {
  const list = datedResults || [];
  const cur = currentBodyweight(player, list);
  if (!cur || !list.length) return list;
  const copy = list.slice();
  const last = copy[copy.length - 1];
  if (Number(last.bodyweight) !== cur.value) copy[copy.length - 1] = { ...last, bodyweight: cur.value };
  return copy;
}

// Construit la liste des résultats DATÉS d'un joueur (jointure campagne→date).
export function datedResultsFor(campaigns, results, playerId) {
  const dateById = Object.fromEntries((campaigns || []).map((c) => [c.id, c.date]));
  return (results || [])
    .filter((r) => r.playerId === playerId)
    .map((r) => ({ ...r, date: dateById[r.campaignId] }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}
