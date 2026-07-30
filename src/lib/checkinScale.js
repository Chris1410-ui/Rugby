/* ═══════════════════════════════════════════════════════════════════════════
   Check-in par GLISSEMENT — échelle 1–5 ⇄ 6 marqueurs de bien-être.
   ───────────────────────────────────────────────────────────────────────────
   Le curseur « Comment tu te sens ? » pose UNE valeur 1–5 en un seul geste.
   On la décline sur les 6 marqueurs stockés dans `daily_checkins.wb`
   (sleep, energy, fatigue, soreness, mood, stress — chacun 0–10) de façon
   cohérente, PUIS ce sont les formules EXISTANTES (`wbToWellness`,
   `computeReadiness`) qui font foi. Ce module ne calcule aucun indicateur : il
   ne fait que TRADUIRE un geste en marqueurs, et l'inverse pour ré-afficher.

   Invariants :
   - `sleep_h` n'est PAS dérivé du geste (on n'invente pas d'heures de sommeil).
     Laissé à null → `computeReadiness` garde son défaut existant (comportement
     inchangé quand le sommeil n'est pas saisi). Le marqueur `wb.sleep` sert de
     repli au terme sommeil de `wbToWellness`, comme aujourd'hui.
   - `wb.quick` mémorise la valeur 1–5 du geste. C'est une clé LIBRE du jsonb,
     ignorée par toutes les formules (elles ne lisent que des clés nommées) →
     aucune migration, aucun impact sur readiness/wellness/points.
   ═══════════════════════════════════════════════════════════════════════════ */

export const QUICK_MIN = 1;
export const QUICK_MAX = 5;

// Borne une valeur de geste sur l'entier [1..5].
export function clampQuick(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return QUICK_MIN;
  return Math.max(QUICK_MIN, Math.min(QUICK_MAX, n));
}

// Niveau « positif » 0–10 correspondant à un geste 1–5 : 1→2, 2→4, 3→6, 4→8, 5→10.
// (Évite les extrêmes 0/10 sauf aux bornes, pour un rendu wellness monotone.)
export function quickToLevel(v) {
  return 2 + (clampQuick(v) - 1) * 2;
}

/* Geste 1–5 → objet `wb` complet (6 marqueurs). Les marqueurs « positifs »
   (energy, mood, sleep) prennent le niveau L ; les marqueurs « à rebours »
   (fatigue, soreness, stress) prennent 10 − L. On mémorise le geste dans
   `wb.quick`. `base` (wb déjà saisi) est fusionné D'ABORD, puis écrasé par le
   geste — ainsi un check-in rapide ne détruit pas d'éventuelles clés annexes. */
export function quickToWb(v, base = {}) {
  const q = clampQuick(v);
  const L = quickToLevel(q);
  return {
    ...base,
    energy: L,
    mood: L,
    sleep: L,
    fatigue: 10 - L,
    soreness: 10 - L,
    stress: 10 - L,
    quick: q,
  };
}

/* Payload prêt pour `saveCheckin(me.id, payload, undefined, "matin")`.
   Part du bilan matin déjà persisté (`prevMatin`) pour PRÉSERVER sleep_h /
   hydra / activités / mesures récup si le joueur les a déjà renseignés, puis
   remplace uniquement le `wb` par la version dérivée du geste. */
export function quickCheckinPayload(v, prevMatin = null) {
  const p = prevMatin || {};
  return {
    wb: quickToWb(v, p.wb || {}),
    sleepH: p.sleepH ?? null,
    hydra: p.hydra ?? 2.0,
    fc: p.fc ?? null,
    hrv: p.hrv ?? null,
    poids: p.poids ?? null,
    activities: p.activities ?? [],
  };
}

/* wb → geste 1–5 pour ré-afficher le curseur (et savoir s'il vient d'un geste).
   Si `wb.quick` existe, on le restitue directement. Sinon on estime le geste
   depuis les marqueurs positifs (moyenne energy/mood ramenée sur 1–5) → un
   bilan saisi via le formulaire détaillé se place quand même sur le curseur. */
export function wbToQuick(wb) {
  if (!wb) return null;
  if (Number.isFinite(Number(wb.quick))) return clampQuick(wb.quick);
  const pos = [wb.energy, wb.mood].filter((x) => Number.isFinite(Number(x)));
  if (!pos.length) return null;
  const avg10 = pos.reduce((a, b) => a + Number(b), 0) / pos.length; // 0–10
  return clampQuick(1 + (avg10 / 10) * 4);
}

// Un bilan matin a-t-il été posé via le geste rapide (vs formulaire détaillé) ?
export function isQuickCheckin(wb) {
  return !!wb && Number.isFinite(Number(wb.quick));
}

/* Série de check-in : nombre de JOURS CONSÉCUTIFS (jusqu'à aujourd'hui inclus)
   avec un bilan du matin. Purement dérivé des lignes daily_checkins déjà
   chargées (lecture seule, aucune table, aucune formule de points touchée).
   `checkins` = lignes { date:'YYYY-MM-DD', moment } quelconques (du + récent au
   + ancien ou non — on ne suppose pas l'ordre). `todayIso` = date locale du jour.
   Tolérance : si le bilan d'aujourd'hui n'est pas encore fait mais que celui
   d'hier l'est, la série d'hier compte encore (elle n'est pas « cassée » tant
   que la journée n'est pas finie). */
export function checkinStreak(checkins = [], todayIso) {
  const days = new Set(
    (checkins || [])
      .filter((c) => c && (c.moment === "matin" || c.moment == null) && c.date)
      .map((c) => c.date),
  );
  if (!todayIso) return 0;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const start = new Date(todayIso + "T00:00:00");
  if (Number.isNaN(start.getTime())) return 0;
  // Point de départ : aujourd'hui s'il est fait, sinon hier (grâce « jour en cours »).
  let cursor = new Date(start);
  if (!days.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(iso(cursor))) return 0;
  }
  let n = 0;
  while (days.has(iso(cursor))) {
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
