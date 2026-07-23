/* ════════════ Compteurs de pastilles (badges) ════════════
   Source de vérité UNIQUE et transversale pour les pastilles « non-traité »
   affichées sur la barre du bas + le hub « Plus » (joueur ET staff).

   Principe : la pastille reflète l'ÉTAT RÉEL en attente (dérivé des données déjà
   chargées et abonnées au realtime), pas le journal `notifications` — qui n'est
   alimenté que pour les inputs créés APRÈS la migration 0026 et se vide dès
   qu'on ouvre l'onglet. Un questionnaire non rempli, une tâche à valider ou une
   séance non validée doit garder sa pastille tant que ce n'est pas fait.

   Fonctions pures → testables, sans accès réseau. */

import { buildAlerts, statusOfLog } from "./metrics.js";

/* Objectif hebdomadaire (hub « Aujourd'hui ») : nombre minimum de JOURS
   d'entraînement validés par semaine. Un jour est « validé » = au moins une
   séance/programme assigné ce jour-là passé en statut `done`. Constante produit
   (paramétrage par le staff possible plus tard). */
export const WEEKLY_GOAL_DAYS = 3;

const skey = (pid, k) => `${pid}|${k}`;

/* ── Côté joueur ── */

// Séances du jour qui me sont assignées et pas encore validées (status ≠ done).
export const playerSessionTodo = (sessions = [], logs = {}, myId, today) =>
  sessions.filter((s) => s.date === today && (s.assignedIds || []).includes(myId) && statusOfLog(logs, s.id, myId) !== "done").length;

// Tâches qui m'attendent : je ne les ai pas encore marquées « fait ».
export const playerTaskTodo = (tasks = [], statutByTask = {}, myId) =>
  tasks.filter((t) => (t.assignedIds || []).includes(myId) && (statutByTask[t.id] || "a_faire") === "a_faire").length;

// Questionnaires qui me sont assignés et pas encore remplis.
export const questionnaireTodo = (list = []) =>
  list.filter((a) => a.statut !== "rempli").length;

// Bilans du jour encore à compléter (matin / soir) : nombre manquant (0, 1 ou 2).
export const bilanTodo = (day = {}) => (day?.matin ? 0 : 1) + (day?.soir ? 0 : 1);

// Défis qui m'attendent : assignés ou ouverts, pas encore relevés.
export const playerChallengeTodo = (challenges = [], statutByChallenge = {}, myId) =>
  challenges.filter((c) => (c.assigned?.mode === "open" || (c.assignedIds || []).includes(myId)) && (statutByChallenge[c.id] || "a_faire") === "a_faire").length;

/* ── Côté staff ── */

// Tâches « faites » par un joueur en attente de confirmation du coach.
export const staffTaskToConfirm = (byTask = {}) =>
  Object.values(byTask).reduce((n, comps) => n + Object.values(comps).filter((c) => c.statut === "validee_joueur").length, 0);

// Assignations de questionnaires encore non remplies (toute l'équipe).
export const staffQuestionnaireTodo = (byQuestionnaire = {}) =>
  Object.values(byQuestionnaire).reduce((n, byPlayer) => n + Object.values(byPlayer).filter((a) => a.statut !== "rempli").length, 0);

// Alertes actives du jour : générées en direct, moins celles traitées aujourd'hui.
export const activeAlertsCount = (players = [], sessions = [], logs = {}, checkins = {}, statuses = [], today) => {
  const treated = new Set(statuses.filter((s) => s.date === today && s.treatedAt).map((s) => skey(s.playerId, s.akey)));
  return buildAlerts(players, sessions, logs, checkins).filter((a) => !treated.has(skey(a.pid, a.key))).length;
};
