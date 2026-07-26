/* Couche d'analyse — PR-3 : DISTRIBUTIONS par ligne/poste (k-anonymat).
   Situer un joueur par rapport à ses pairs SANS exposer la moindre valeur
   individuelle de coéquipier : on ne renvoie que la FORME agrégée (quantiles,
   moyenne) d'un ensemble ≥ kAnonMin, et le rang percentile d'UNE valeur choisie.

   Purement fonctionnel/testable. NE MODIFIE aucune formule : les valeurs sont
   extraites en amont (tests Top 14 / champs physiques), on ne fait que les
   résumer. Une valeur PAR joueur en entrée (dédup fait par l'appelant). */
import { RELIABILITY } from "./dataQuality.js";

// Quantile par interpolation linéaire sur un tableau trié croissant.
export function quantileSorted(sorted, q) {
  if (!sorted || !sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* Distribution d'un ensemble de valeurs, GATÉE par k-anonymat : min / Q1 / médiane
   / Q3 / max + moyenne + n, ou { hidden:true, n } sous kAnonMin valeurs (on ne
   révèle jamais la forme d'un groupe trop petit). */
export function distribution(values, kMin = RELIABILITY.kAnonMin) {
  const clean = (values || []).filter((v) => typeof v === "number" && Number.isFinite(v));
  const n = clean.length;
  if (n < kMin) return { hidden: true, n };
  const s = [...clean].sort((a, b) => a - b);
  return {
    hidden: false, n,
    min: s[0], q1: quantileSorted(s, 0.25), median: quantileSorted(s, 0.5), q3: quantileSorted(s, 0.75), max: s[s.length - 1],
    mean: clean.reduce((a, b) => a + b, 0) / n,
  };
}

/* Rang percentile d'une valeur dans un ensemble, en respectant le sens du métrique
   (`dir` : 'up' = plus haut est meilleur ; 'down' = plus bas est meilleur).
   Renvoie 0-100 : « meilleur que X % du groupe » (rang moyen, gère les ex-æquo).
   N'expose aucune valeur individuelle — juste un rang. */
export function percentileOf(value, values, dir = "up") {
  const clean = (values || []).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!clean.length || typeof value !== "number" || !Number.isFinite(value)) return null;
  const worse = clean.filter((v) => (dir === "down" ? v > value : v < value)).length;
  const equal = clean.filter((v) => v === value).length;
  return Math.round(((worse + equal / 2) / clean.length) * 100);
}
