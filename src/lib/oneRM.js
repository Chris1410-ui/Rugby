/* Progression en % de 1RM : parsing des cellules `@xx%`, calcul de la charge
   réelle depuis le 1RM d'un joueur, et résolution du 1RM courant / historique.
   Pur & testable. NE MODIFIE aucune formule existante : réutilise e1RM (Epley)
   et exKey (normalisation anti-doublon) de lib/hevy.js. */
import { e1RM, exKey } from "./hevy.js";

// Incrément d'arrondi par défaut (kg). Configurable plus tard par exercice.
export const DEFAULT_INCREMENT = 2.5;

// Identité stable d'un mouvement : l'exercise_id de la bibliothèque quand l'exo
// est lié, sinon la clé normalisée du nom (« Hip thrust » = « hip-thrust »).
export function movementIdentity({ exerciseId, name } = {}) {
  return exerciseId ? `ex:${exerciseId}` : `k:${exKey(name)}`;
}

/* Parse une cellule de progression. Reconnaît sets×reps, `@xx%` (pourcentage du
   1RM), une charge absolue `NNkg`, et l'étoile de pic ★. Mixable cellule par
   cellule — le pourcentage n'écrase jamais l'absolu existant. */
export function parseProgressionCell(text) {
  const s = String(text || "").trim();
  const star = /★/.test(s); // pic (le * de multiplication ne compte pas)
  const m = s.match(/(\d+)\s*[x×*]\s*(\d+(?:\s*[-–]\s*\d+)?)/);
  const sets = m ? m[1] : "";
  const reps = m ? m[2].replace(/\s+/g, "").replace(/–/g, "-") : "";
  // % du 1RM : accepte les DEUX ordres — @70% et 70%@.
  const pm = s.match(/@\s*(\d{1,3}(?:[.,]\d)?)\s*%/) || s.match(/(\d{1,3}(?:[.,]\d)?)\s*%\s*@/);
  const pct = pm ? Number(pm[1].replace(",", ".")) : null;
  let abs = null;
  if (pct == null) {
    const am = s.match(/([\d.,]+)\s*kg/i);
    if (am) abs = `${am[1].replace(",", ".")}kg`;
  }
  // Contient @ ou % mais rien de reconnu → syntaxe à SIGNALER (pas ignorer).
  const unknown = /[@%]/.test(s) && pct == null && abs == null;
  return { sets, reps, pct, star, abs, unknown, raw: s };
}

// Arrondi à l'incrément disponible (2,5 kg par défaut). Robuste aux flottants.
export function roundToIncrement(kg, inc = DEFAULT_INCREMENT) {
  if (!(kg > 0)) return 0;
  const step = inc > 0 ? inc : 1;
  return Number((Math.round(kg / step) * step).toFixed(2));
}

/* Charge réelle depuis un pourcentage + le 1RM du joueur. Retourne null si le
   1RM manque (on n'affiche JAMAIS 0 ni une charge fausse). */
export function computeLoadKg(pct, oneRM, inc = DEFAULT_INCREMENT) {
  if (!(pct > 0) || !(oneRM > 0)) return null;
  return roundToIncrement((oneRM * pct) / 100, inc);
}

// 1RM estimé (Epley) depuis un test sous-max — réutilise e1RM tel quel.
export function estimate1RM(weight, reps) {
  return e1RM(Number(weight), Number(reps));
}

/* Statistiques d'équipe pour UN mouvement : 1RM moyen (courant par joueur) et
   nombre de joueurs sans 1RM, sur un effectif `players`. Sert au constructeur
   (aperçu de charge « ≈ N kg pour 1RM moyen » + « X joueurs sans 1RM »). Pur. */
export function movementTeamStats(entries = [], players = [], movement = {}) {
  const id = movementIdentity(movement);
  const byPlayer = new Map(); // playerId → valeur courante (la plus récente)
  for (const e of entries) {
    if (e.valueKg == null) continue;
    if (movementIdentity({ exerciseId: e.exerciseId, name: e.movementLabel || e.name }) !== id) continue;
    const stamp = `${e.measuredAt || ""}|${e.createdAt || ""}`;
    const prev = byPlayer.get(e.playerId);
    if (!prev || stamp > prev.stamp) byPlayer.set(e.playerId, { value: Number(e.valueKg), stamp });
  }
  const rosterIds = (players || []).map((p) => p.id);
  const values = rosterIds.map((pid) => byPlayer.get(pid)?.value).filter((v) => v != null);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return { avg, have: values.length, missing: Math.max(0, rosterIds.length - values.length), total: rosterIds.length };
}

/* Résout le 1RM COURANT + l'historique par mouvement depuis les lignes player_1rm.
   Une ligne avec value_kg = mesure ; value null = placeholder « à renseigner ».
   Retourne un tableau [{ identity, label, exerciseId, value, kind, measuredAt,
   missing, history[] }] trié par libellé. Le courant = mesure la plus récente. */
export function summarize1RM(entries = []) {
  const byId = new Map();
  for (const e of entries) {
    const id = movementIdentity({ exerciseId: e.exerciseId, name: e.movementLabel || e.name });
    if (!byId.has(id)) byId.set(id, { identity: id, label: e.movementLabel || e.name || "", exerciseId: e.exerciseId || null, rows: [] });
    byId.get(id).rows.push(e);
  }
  const stamp = (r) => `${r.measuredAt || ""}|${r.createdAt || ""}`;
  const out = [];
  for (const g of byId.values()) {
    const measured = g.rows.filter((r) => r.valueKg != null).sort((a, b) => (stamp(a) < stamp(b) ? 1 : -1));
    const current = measured[0] || null;
    out.push({
      identity: g.identity,
      label: g.label,
      exerciseId: g.exerciseId,
      value: current ? Number(current.valueKg) : null,
      kind: current ? current.kind : null,
      measuredAt: current ? current.measuredAt : null,
      missing: !current,                    // aucune mesure → « à renseigner »
      history: measured.map((r) => ({ value: Number(r.valueKg), kind: r.kind, measuredAt: r.measuredAt })),
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
