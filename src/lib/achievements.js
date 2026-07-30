/* Récompenses « maquette » dérivées des DONNÉES EXISTANTES (aucune table, aucune
   monnaie, aucun point) — purement visuelles, calculées côté client à partir de
   ce que l'app charge déjà. Seuils fournis par le staff. */
import { checkinStreak } from "./checkinScale.js";
import { sessionProgress } from "./sessionProgress.js";

// Décale une date ISO (YYYY-MM-DD) de `days` jours (négatif = passé).
function shiftIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Couverture du mois EN COURS : jours distincts avec ≥ 1 bilan (matin/soir) /
// jours écoulés depuis le 1er du mois (jusqu'à aujourd'hui inclus). 0..1.
export function monthCoverage(checkins = [], todayIso) {
  if (!todayIso) return 0;
  const d = new Date(todayIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return 0;
  const y = d.getFullYear(), m = d.getMonth(), daysElapsed = d.getDate();
  const days = new Set(
    (checkins || [])
      .filter((c) => c && c.date && (c.moment === "matin" || c.moment === "soir" || c.moment == null))
      .map((c) => c.date)
      .filter((dt) => { const x = new Date(dt + "T00:00:00"); return !Number.isNaN(x.getTime()) && x.getFullYear() === y && x.getMonth() === m; }),
  );
  return daysElapsed > 0 ? days.size / daysElapsed : 0;
}

// Séries LOGGÉES (cochées « faites ») sur les 7 jours glissants (aujourd'hui inclus).
export function weeklyLoggedSets(sessions = [], logs = {}, playerId, todayIso) {
  if (!todayIso) return 0;
  const from = shiftIso(todayIso, -6);
  let n = 0;
  for (const s of sessions || []) {
    if (!s?.date || s.date < from || s.date > todayIso) continue;
    n += sessionProgress(s, logs?.[s.id]?.[playerId]).done;
  }
  return n;
}

/* Ensemble des récompenses ACQUISES, dérivées des données existantes.
   - wellness7      : 7 check-ins consécutifs (checkinStreak ≥ 7)
   - monthComplete  : ≥ 90 % des jours du mois avec une saisie
   - firstRecord    : ≥ 1 record personnel (entrée player_1rm)
   - gpsImport      : ≥ 1 session GPS importée
   - sets100        : ≥ 100 séries loggées sur 7 jours glissants */
export function deriveAchievements({ checkins = [], oneRMCount = 0, gpsCount = 0, weeklySets = 0, todayIso }) {
  const set = new Set();
  if (checkinStreak(checkins, todayIso) >= 7) set.add("wellness7");
  if (monthCoverage(checkins, todayIso) >= 0.9) set.add("monthComplete");
  if (oneRMCount >= 1) set.add("firstRecord");
  if (gpsCount >= 1) set.add("gpsImport");
  if (weeklySets >= 100) set.add("sets100");
  return set;
}
