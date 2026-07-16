/* ════════════════════════════════════════════════════════════════
   metrics.js — MOTEUR MÉTIER (source de vérité UNIQUE)

   Porté tel quel depuis RugbyApp.jsx (prototype de référence).
   RÈGLE D'OR : aucune duplication de formule. Tous les écrans lisent
   le résultat de `enrichPlayers`. Toute réécriture divergente est un bug.

   Formes de données attendues (adaptées depuis Supabase par data/) :
   - players : [{ id, name, num, pos, grp, acwr, wellness, sleep, risque,
                  charge7j, dispo, asym, ischiosG, ischiosD, backSquat, ... }]
   - sessions: [{ id, date:'YYYY-MM-DD', assignedIds:[playerId], dur }]
   - logs    : { [sessionId]: { [playerId]: { status, rpe, perExercise } } }
   - daily   : { [playerId]: { wb:{energy,fatigue,soreness,mood,stress,sleep},
                               sleepH, saved:true } }
   ════════════════════════════════════════════════════════════════ */

import { C } from "./tokens.js";

/* ── Dates ── */
export const isoDate = (d) => {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const parseISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => isoDate(new Date());
export const fmtShort = (s) =>
  parseISO(s).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
export const fmtDay = (s) =>
  parseISO(s).toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" });

/* ── PRNG déterministe (seed scramblé + warmup) ── */
export function rng(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  for (let i = 0; i < 8; i++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return ((s >>> 8) & 0xffffff) / 0x1000000;
  };
}
export const rib = (r, a, b) => Math.round(a + (b - a) * r());
export const rfb = (r, a, b, d = 1) => +(a + (b - a) * r()).toFixed(d);
export const seasonSeed = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h >>> 0;
};

/* ── Zones ACWR (échelle réutilisée partout) ── */
export const acwrZ = (v) =>
  v < 0.8
    ? { l: "Sous-charge", c: C.teal }
    : v <= 1.3
    ? { l: "Cible", c: C.green }
    : v <= 1.5
    ? { l: "Vigilance", c: C.amb }
    : { l: "Surcharge", c: C.coral };

export const statusOfLog = (logs, sid, pid) => logs?.[sid]?.[pid]?.status || "pending";

/* ════════════ MOTEUR DE CHARGE · sRPE / ACWR / monotonie ════════════ */
const sessDur = (s) => s.dur || s.duration || (s.exos ? Math.max(40, s.exos.length * 9) : 60);

// AU quotidiennes calibrées sur l'ACWR seed du joueur, écrasées par les vraies séances loggées
export function loadDaily(p, sessions, logs, nDays = 42) {
  const r = rng(seasonSeed(p.id) + 991);
  const Cw = p.charge7j || 1800; // charge chronique hebdo (AU)
  const acwr0 = p.acwr || 1;
  const out = [];
  const t = new Date();
  // 1) gabarit brut jour par jour (repos dim, mercredi allégé)
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
    const iso = isoDate(d);
    const dow = d.getDay();
    const w = dow === 0 ? 0 : dow === 3 ? 0.4 : 0.7 + r() * 0.9;
    out.push({ date: iso, au: w, dow, real: false });
  }
  // 2) normaliser chaque semaine : semaine courante (acute) → C*acwr0, précédentes → C
  const nWeeks = Math.ceil(nDays / 7);
  for (let w = 0; w < nWeeks; w++) {
    const slice = out.slice(Math.max(0, out.length - (w + 1) * 7), out.length - w * 7);
    const raw = slice.reduce((a, o) => a + o.au, 0) || 1;
    const target = w === 0 ? Cw * acwr0 : Cw;
    slice.forEach((o) => {
      o.au = Math.round((o.au / raw) * target);
    });
  }
  // 3) écraser par les séances réellement validées / manquées
  const mine = sessions.filter((s) => s.assignedIds?.includes(p.id));
  mine.forEach((s) => {
    const lg = logs?.[s.id]?.[p.id];
    const idx = out.findIndex((o) => o.date === s.date);
    if (idx < 0) return;
    if (lg && lg.status === "done" && lg.rpe)
      out[idx] = { ...out[idx], au: Math.round(lg.rpe * sessDur(s)), real: true };
    else if (lg && lg.status === "missed") out[idx] = { ...out[idx], au: 0, real: true };
  });
  return out.map((o) => ({ date: o.date, au: o.au, real: o.real }));
}

export function playerLoad(p, sessions, logs) {
  const hist = loadDaily(p, sessions, logs, 42);
  const last28 = hist.slice(-28);
  const sum = (a) => a.reduce((x, o) => x + o.au, 0);
  const acute = sum(last28.slice(-7));
  const chronic = sum(last28.slice(0, 21)) / 3; // ACWR découplé : 3 semaines précédentes
  const acwr = chronic > 0 ? +(acute / chronic).toFixed(2) : 0;
  const vals7 = last28.slice(-7).map((o) => o.au);
  const mean = vals7.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(vals7.reduce((a, b) => a + (b - mean) ** 2, 0) / 7) || 1;
  const monotony = +(mean / sd).toFixed(2);
  const strain = Math.round(acute * monotony);
  return { hist, acute, chronic: Math.round(chronic), acwr, monotony, strain, zone: acwrZ(acwr) };
}

// bien-être 0-50 à partir du bilan du matin encodé (FORMULE UNIQUE)
export function wbToWellness(wb, sleepH) {
  if (!wb) return null;
  const cl = (v) => Math.max(0, Math.min(10, v));
  const m = [
    cl(wb.energy),
    cl(wb.mood),
    cl(10 - wb.fatigue),
    cl(10 - wb.soreness),
    cl(10 - wb.stress),
    cl(((sleepH || wb.sleep || 7) / 9) * 10),
  ];
  return Math.round((m.reduce((a, b) => a + b, 0) / m.length) * 5);
}

// FORMULE UNIQUE readiness (0-100) — partagée génération/enrichissement/écran joueur
export function computeReadiness(wellness, risque, sleepH) {
  return Math.round((wellness / 50) * 50 + ((100 - risque) / 100) * 30 + ((sleepH || 7) / 10) * 20);
}

// SOURCE DE VÉRITÉ UNIQUE : enrichit chaque joueur (charge + bilan du jour → risque & readiness)
export function enrichPlayers(players, sessions, logs, daily) {
  return players.map((p) => {
    const L = playerLoad(p, sessions, logs);
    const dd = daily?.[p.id];
    const wb = dd?.wb;
    const sleepH = dd?.sleepH;
    const wellness = wb && dd?.saved ? wbToWellness(wb, sleepH) : p.wellness;
    const sleep = sleepH && dd?.saved ? sleepH : p.sleep;
    const acwr = L.acwr || p.acwr;
    const acwrPen = acwr > 1.5 ? 100 : acwr > 1.3 ? 60 : acwr < 0.8 ? 40 : 10;
    const asymPen = Math.min(100, (p.asym || 0) * 12);
    const wellPen = Math.round(((50 - wellness) / 50) * 100);
    const screenPen = Math.min(
      100,
      (p.ischiosG < 280 || p.ischiosD < 280 ? 60 : 20) + (p.backSquat < 1.0 ? 30 : 0)
    );
    const dispoPen = 100 - (p.dispo || 90);
    const risque = Math.max(
      5,
      Math.min(
        98,
        Math.round(
          acwrPen * 0.34 + asymPen * 0.24 + wellPen * 0.18 + screenPen * 0.14 + dispoPen * 0.1
        )
      )
    );
    const readiness = computeReadiness(wellness, risque, sleep);
    const wbFields =
      wb && dd?.saved
        ? { energy: wb.energy, fatigue: wb.fatigue, soreness: wb.soreness, mood: wb.mood, stress: wb.stress }
        : {};
    return {
      ...p,
      ...wbFields,
      acwr,
      wellness,
      sleep,
      risque,
      readiness,
      charge7j: L.acute,
      monotonie: L.monotony,
      strain: L.strain,
      _load: L,
      _live: !!(wb && dd?.saved),
    };
  });
}

/* ════════════ POINTS / DIVISIONS ════════════ */
export const DIVS = [
  { min: 220, l: "Élite", c: "#27E8D6", e: "💎" },
  { min: 170, l: "Diamant", c: "#8AB4F8", e: "🔷" },
  { min: 120, l: "Or", c: "#F2C84B", e: "🥇" },
  { min: 70, l: "Argent", c: "#C8D2E0", e: "🥈" },
  { min: 0, l: "Bronze", c: "#C07A45", e: "🥉" },
];
export const divOf = (p) => DIVS.find((d) => p >= d.min) || DIVS[DIVS.length - 1];
export const nextDiv = (p) => {
  const i = DIVS.findIndex((d) => p >= d.min);
  return i > 0 ? DIVS[i - 1] : null;
};

// Activités déclarables sur l'écran Aujourd'hui (#6) — +10 pts par thématique.
export const ACTIVITIES = [
  { key: "salle", label: "Salle", emoji: "🏋️" },
  { key: "course", label: "Course", emoji: "🏃" },
  { key: "natation", label: "Natation", emoji: "🏊" },
];
const ACTIVITY_LABEL = Object.fromEntries(ACTIVITIES.map((a) => [a.key, a.label]));

// `dailyActivities` : historique d'activités déclarées du joueur → [{ date, activities:[keys] }].
// `top14Events` : tests validés Top 14 → [{ label, date }] (calculés en amont via
//   lib/top14.js). +30 pts par test, DATÉS de la 1re validation → un seul crédit
//   par test (pas de double comptage aux re-saisies).
export function computePoints(player, sessions, logs, dailyActivities = [], top14Events = []) {
  let pts = 100; // base fixe : 100 pts par joueur (#6)
  const ev = [];
  let weekDelta = 0,
    streak = 0,
    missedRun = 0,
    doneCount = 0,
    missedCount = 0,
    filledAll = true;
  const today = todayISO(),
    wkAgo = isoDate(new Date(Date.now() - 7 * 864e5));
  function add(v, label, date, inWeek) {
    pts += v;
    ev.push({ v, label, date });
    if (inWeek) weekDelta += v;
  }
  const mine = sessions
    .filter((s) => s.assignedIds.includes(player.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  mine.forEach((s) => {
    const lg = logs?.[s.id]?.[player.id];
    // Grace « séance du jour » : une séance datée aujourd'hui encore en attente
    // n'est PAS pénalisée (la journée n'est pas finie / elle peut être reportée).
    const overdue = s.date < today;
    const inWk = s.date >= wkAgo && s.date <= today;
    if (lg && lg.status === "done") {
      doneCount++;
      streak++;
      missedRun = 0;
      add(10, "Séance validée", s.date, inWk);
      add(5, "Ponctualité", s.date, inWk);
      const filled = Object.values(lg.perExercise || {}).some((v) => v.charge || v.reps || v.rpe);
      if (filled) add(2, "Valeurs renseignées", s.date, inWk);
      else filledAll = false;
    } else if (lg && lg.status === "missed") {
      missedCount++;
      missedRun++;
      streak = 0;
      add(-15, "Séance manquée", s.date, inWk);
      if (missedRun >= 2) add(-10, "Manquées consécutives", s.date, inWk);
    } else if (lg && lg.status === "postponed") {
      // Séance remise/reportée : ni gain ni pénalité, ne casse pas la série.
      add(0, "Séance reportée", s.date, inWk);
    } else if (overdue) {
      missedCount++;
      missedRun++;
      streak = 0;
      add(-15, "Séance non validée", s.date, inWk);
    }
  });
  // Activité du jour déclarée (salle / course / natation) : +10 par thématique.
  (dailyActivities || []).forEach((d) => {
    const inWk = d.date >= wkAgo && d.date <= today;
    (d.activities || []).forEach((a) => add(10, `Activité : ${ACTIVITY_LABEL[a] || a}`, d.date, inWk));
  });
  // Tests atteignant le niveau Top 14 du poste : +30 par test (une seule fois,
  // daté de la 1re validation → compte dans le total ET le delta de la semaine).
  (top14Events || []).forEach((e) => {
    const inWk = e.date >= wkAgo && e.date <= today;
    add(30, `Top 14 : ${e.label}`, e.date, inWk);
  });
  if (streak >= 5) add(15, "Série de 5 séances 🔥", today, true);
  else if (streak >= 3) add(5, "Série de 3 séances", today, true);
  if (player.acwr >= 0.8 && player.acwr <= 1.3) add(8, "ACWR en cible", today, true);
  else if (player.acwr > 1.5) add(-8, "ACWR surcharge", today, true);
  else if (player.acwr < 0.8) add(-8, "ACWR sous-charge", today, true);
  pts = Math.max(0, Math.round(pts));
  const badges = [];
  if (streak >= 3) badges.push({ l: "Assidu", e: "🔥" });
  if (missedCount === 0 && doneCount > 0) badges.push({ l: "Sans faute", e: "✅" });
  if (player.acwr >= 0.8 && player.acwr <= 1.3) badges.push({ l: "En forme", e: "💪" });
  if (filledAll && doneCount > 0) badges.push({ l: "Rigoureux", e: "📊" });
  return {
    pts,
    weekDelta: Math.round(weekDelta),
    streak,
    doneCount,
    missedCount,
    ev: ev.slice().reverse(),
    badges,
    div: divOf(pts),
  };
}

/* ════════════ ALERTES AUTO ════════════ */
export function buildAlerts(players, sessions, logs, daily) {
  const out = [];
  const today = todayISO();
  players.forEach((p) => {
    const L = p._load || playerLoad(p, sessions, logs);
    if (L.acwr > 1.5)
      out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "high", icon: "⚡", txt: `ACWR ${L.acwr} — zone de surcharge`, cat: "charge", key: "acwr-high" });
    else if (L.acwr > 0 && L.acwr < 0.8)
      out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "low", icon: "📉", txt: `ACWR ${L.acwr} — sous-charge (désentraînement)`, cat: "charge", key: "acwr-low" });
    if (L.monotony > 2)
      out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "med", icon: "🔁", txt: `Monotonie ${L.monotony} — manque de variété de charge`, cat: "charge", key: "monotony" });
    const dd = daily?.[p.id];
    if (dd?.wb) {
      if (dd.wb.fatigue >= 8)
        out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "high", icon: "🥵", txt: `Fatigue déclarée ${dd.wb.fatigue}/10`, cat: "bien-être", key: "fatigue" });
      if (dd.wb.soreness >= 8)
        out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "med", icon: "💢", txt: `Courbatures ${dd.wb.soreness}/10`, cat: "bien-être", key: "soreness" });
      if (dd.wb.sleep <= 4 || dd.sleepH <= 5)
        out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "med", icon: "😴", txt: `Sommeil insuffisant (${dd.sleepH || dd.wb.sleep}${dd.sleepH ? "h" : "/10"})`, cat: "bien-être", key: "sleep" });
    }
    const overdue = sessions.filter(
      (s) => s.assignedIds?.includes(p.id) && s.date < today && statusOfLog(logs, s.id, p.id) === "pending"
    ).length;
    if (overdue > 0)
      out.push({ pid: p.id, name: p.name, grp: p.grp, sev: "med", icon: "⏳", txt: `${overdue} séance${overdue > 1 ? "s" : ""} non validée${overdue > 1 ? "s" : ""}`, cat: "compliance", key: "overdue" });
  });
  const order = { high: 0, med: 1, low: 2 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}

export const SEVC = { high: C.coral, med: C.amb, low: C.teal };
