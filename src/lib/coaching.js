/* Couche d'analyse — PR-5 : RECOMMANDATIONS + ALERTES PROACTIVES.
   Synthèse déterministe, à l'échelle de l'effectif, qui COMPOSE les couches déjà
   en place — fiabilité (PR-1), adhérence (PR-2), charge/readiness (metrics) — en
   recommandations d'action priorisées et GATÉES par la fiabilité (on ne conseille
   pas sur des données trop minces).

   NE MODIFIE aucune formule (playerLoad, computeReadiness, enrichPlayers, risque…) :
   on LIT leurs sorties (p._load.zone, p.risque, p.readiness, p._live) et celles des
   libs d'analyse. Complémentaire — et non redondant — avec :
   - buildAlerts (metrics) : triage AIGU du jour, non gaté par la fiabilité ;
   - la fonction Edge `recommendations` : conseil IA en prose, un joueur à la fois.
   Ici : moteur pur, tout l'effectif, objets typés, prêts pour un fil d'actions. */
import { todayISO, playerLoad } from "./metrics.js";
import { displayName } from "./identity.js";
import { loadReliability, teamDataCompleteness } from "./dataQuality.js";
import { teamAdherence } from "./adherence.js";

export const RECO = {
  monotonyHigh: 2,   // monotonie > 2 (aligné buildAlerts)
  riskHigh: 60,      // indice de risque composite ≥ 60 (aligné fallback/enrichPlayers)
  readinessLow: 40,  // readiness < 40 → allègement
};

const SEV_ORDER = { high: 0, med: 1, low: 2 };
// Catégorie d'une recommandation (pour regroupement/couleur) : action staff (programme)
// vs contact joueur. Sert aussi à décider où proposer un message.
export const ENGAGEMENT_KINDS = new Set(["adherence", "reengage"]);

/* Recommandations d'UN joueur (déjà enrichi : _load, risque, readiness, _live).
   Les recos de CHARGE sont émises seulement si la charge est fiable (assez de
   séances loggées, seuil PR-1) — sinon on se tait plutôt que de sur-alerter. */
function playerRecos(p, ctx) {
  const out = [];
  const L = p._load || playerLoad(p, ctx.sessions, ctx.logs);
  const rel = loadReliability(p, ctx.sessions, ctx.logs, ctx.today);
  const zone = L.zone?.key;
  const add = (kind, sev, cat, evidence = {}) => out.push({ playerId: p.id, name: displayName(p), grp: p.grp, kind, sev, cat, evidence });

  if (rel.reliable) {
    if (zone === "over") add("overload", "high", "charge", { acwr: L.acwr });
    else if (zone === "under") add("undertrain", "low", "charge", { acwr: L.acwr });
    if (L.monotony > RECO.monotonyHigh) add("monotony", "med", "charge", { monotony: L.monotony });
  }
  if (typeof p.risque === "number" && p.risque >= RECO.riskHigh) add("prevention", "med", "prevention", { risque: p.risque });
  if (p._live && typeof p.readiness === "number" && p.readiness < RECO.readinessLow) add("lowReadiness", "med", "wellbeing", { readiness: p.readiness });
  if (ctx.belowAdh.has(p.id)) add("adherence", "high", "engagement", { rate: ctx.adhRate.get(p.id) });
  if (ctx.disengaged.has(p.id)) add("reengage", "med", "engagement", {});
  return out;
}

/* Recommandations d'équipe : liste priorisée (sévérité puis nom), regroupement
   par joueur, et compteurs. `belowIds`/`noBilan` viennent des couches PR-2/PR-1
   (déjà cloisonnées par club en amont). Aucun agrégat collectif exposé : ce sont
   des actions nominatives destinées au staff (qui voit légitimement l'individu). */
export function teamRecommendations({ players = [], sessions = [], logs = {}, bilans = {}, oneRM = [], today = todayISO() } = {}) {
  const adh = teamAdherence({ players, sessions, logs, today });
  const dq = teamDataCompleteness({ players, sessions, logs, oneRM, bilans, today });
  const ctx = {
    sessions, logs, today,
    belowAdh: new Set(adh.belowIds),
    adhRate: new Map(adh.rows.map((r) => [r.id, r.rate])),
    disengaged: new Set(dq.noBilan.ids),
  };
  const recos = players.flatMap((p) => playerRecos(p, ctx));
  recos.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || String(a.name).localeCompare(String(b.name)));

  const byPlayer = new Map();
  recos.forEach((r) => { if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, { playerId: r.playerId, name: r.name, grp: r.grp, recos: [], topSev: r.sev, engagement: false }); const e = byPlayer.get(r.playerId); e.recos.push(r); if (ENGAGEMENT_KINDS.has(r.kind)) e.engagement = true; });

  return {
    recos,
    players: [...byPlayer.values()], // déjà triés : le 1er reco de chaque joueur porte sa sévérité max
    counts: { high: recos.filter((r) => r.sev === "high").length, med: recos.filter((r) => r.sev === "med").length, low: recos.filter((r) => r.sev === "low").length },
    nPlayers: byPlayer.size,
  };
}
