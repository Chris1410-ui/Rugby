/* Calculs centralisés du rapport de performance. Produit un « view-model » pur
   (aucun accès réseau, testable) consommé par le gabarit et le module narratif.
   S'appuie sur le référentiel Top 14 existant (lib/top14.js) : % vs cible,
   statut et points ne sont jamais écrits en dur. */

import { top14Player } from "../top14.js";
import { REPORT_TEST_BY_KEY, thresholdFor, strengthTargetKg, frNum, secToMMSS, roundKg } from "./standards.js";

const POINTS_PER_STANDARD = 30; // règle confirmée : +30 par standard atteint.

// Tests du tableau principal (p4) + barres (p5).
const CORE_KEYS = ["bronco", "cmj", "squat", "bench"];
// Tests « à compléter » (p6), répartis en deux colonnes.
const MISSING_STRENGTH = ["deadlift", "hangclean", "tractions"];
const MISSING_CARDIO = ["mas", "yoyo"];

// Affichage « mesure brute » selon le type de test.
function rawDisplay(key, value, weightKg) {
  if (value == null) return "Non mesuré";
  const meta = REPORT_TEST_BY_KEY[key];
  if (key === "bronco") return secToMMSS(value);
  if (meta.perBw) {
    const kg = weightKg > 0 ? ` (${frNum(value, 2)} × PC)` : "";
    return weightKg > 0 ? `${roundKg(value * weightKg)} kg${kg}` : `${frNum(value, 2)} × PC`;
  }
  return `${frNum(value)} ${meta.unit || ""}`.trim();
}

// Affichage « standard » (borne basse Top 14) selon le type de test.
function standardDisplay(key, pos, weightKg) {
  const thr = thresholdFor(pos, key);
  if (thr == null) return "—";
  const meta = REPORT_TEST_BY_KEY[key];
  if (key === "bronco") return `≤ ${secToMMSS(thr)}`;
  if (meta.perBw) {
    const kg = strengthTargetKg(pos, key, weightKg);
    return kg ? `${frNum(thr, 2)} × PC (≈ ${roundKg(kg)} kg)` : `${frNum(thr, 2)} × PC`;
  }
  const sign = meta.dir === "down" ? "≤" : "≥";
  return `${sign} ${frNum(thr)} ${meta.unit || ""}`.trim();
}

// Poids de corps courant (dernier non nul), pour les ratios × PC.
function currentBodyweight(results, fallback) {
  for (let i = (results || []).length - 1; i >= 0; i--) {
    const b = results[i]?.bodyweight;
    if (b != null && Number(b) > 0) return Number(b);
  }
  return fallback != null && Number(fallback) > 0 ? Number(fallback) : null;
}

/* input = {
     player: { name, pos, posLabel, heightCm, weightKg, sessionsPerWeek, injuryHistory },
     wellbeing: { mood, stress, sleep },       // /10, dernier check-in (peut être {})
     results: [ testResultRow… ],              // datés croissants, colonnes de tests + bodyweight
     dates:  { testDate, wellnessDate, generatedAt },
   } */
export function buildReportModel(input) {
  const p = input.player || {};
  const wb = input.wellbeing || {};
  const results = input.results || [];
  const weightKg = currentBodyweight(results, p.weightKg);
  const t14 = top14Player(p.pos, results); // { byTest, count, events }

  const evalOf = (key) => t14.byTest[key] || { value: null, threshold: thresholdFor(p.pos, key), pct: null, valid: false };
  const measured = (key) => evalOf(key).value != null;

  // Tableau principal (core mesurés) + ligne poids de corps (référence).
  const tableRows = CORE_KEYS.filter(measured).map((key) => {
    const e = evalOf(key);
    return {
      key, label: REPORT_TEST_BY_KEY[key].label,
      raw: rawDisplay(key, e.value, weightKg),
      standard: standardDisplay(key, p.pos, weightKg),
      pct: e.pct == null ? null : Math.round(e.pct),
      status: e.valid ? "met" : "dev",
    };
  });
  tableRows.push({ key: "bodyweight", label: "Poids de corps (référence)", raw: weightKg ? `${roundKg(weightKg)} kg` : "—", standard: "—", pct: null, status: "ref" });

  // Barres comparatives (core mesurés).
  const bars = CORE_KEYS.filter(measured).map((key) => {
    const e = evalOf(key);
    return { key, label: REPORT_TEST_BY_KEY[key].label, pct: Math.round(e.pct), met: e.valid };
  });

  // Tests manquants (référentiel absent des données), avec cibles calibrées au poids.
  const missingCol = (keys) => keys.filter((k) => !measured(k)).map((key) => {
    const meta = REPORT_TEST_BY_KEY[key];
    const thr = thresholdFor(p.pos, key);
    let target;
    if (meta.perBw) {
      const kg = strengthTargetKg(p.pos, key, weightKg);
      target = `${meta.plus ? "+" : ""}${frNum(thr, 2)} × PC${kg ? ` (Cible : ≈ ${meta.plus ? "+" : ""}${roundKg(kg)} kg)` : ""}`;
    } else if (key === "mas") {
      target = thr ? `Cible ${frNum(thr)} m/s (≈ ${Math.round(thr * 3.6)} km/h)` : "Cible à définir";
    } else {
      target = thr ? `Cible ${roundKg(thr)} m` : "Cible à définir";
    }
    return { key, label: meta.label, target };
  });

  const standardsMet = t14.count;
  const kpis = {
    standardsMet,
    points: standardsMet * POINTS_PER_STANDARD,
    broncoPct: evalOf("bronco").pct == null ? null : Math.round(evalOf("bronco").pct),
    jumpPct: evalOf("cmj").pct == null ? null : Math.round(evalOf("cmj").pct),
  };

  return {
    player: {
      name: p.name, posLabel: p.posLabel || p.pos || "—",
      heightCm: p.heightCm ?? null, weightKg,
      sessionsPerWeek: p.sessionsPerWeek ?? null,
      injuryHistory: (p.injuryHistory || "").trim(),
    },
    wellbeing: { mood: wb.mood ?? null, stress: wb.stress ?? null, sleep: wb.sleep ?? null },
    dates: input.dates || {},
    weightKg,
    kpis,
    tableRows,
    bars,
    missing: { strength: missingCol(MISSING_STRENGTH), cardio: missingCol(MISSING_CARDIO) },
    // Drapeaux pour le module narratif (règles).
    flags: {
      fieldStrong: evalOf("bronco").valid || evalOf("cmj").valid,
      strengthDeficit: (evalOf("squat").value != null && !evalOf("squat").valid) || (evalOf("bench").value != null && !evalOf("bench").valid),
      lowSleep: wb.sleep != null && wb.sleep <= 6,
      lowMood: wb.mood != null && wb.mood <= 4,
      highStress: wb.stress != null && wb.stress >= 7,
      hasInjuries: !!(p.injuryHistory || "").trim(),
      hasMissing: missingCol(MISSING_STRENGTH).length + missingCol(MISSING_CARDIO).length > 0,
    },
  };
}
