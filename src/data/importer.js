import { addPlayer, updatePlayer } from "./players.js";
import { createCampaign, saveResultsBulk } from "./tests.js";
import { fmtShort, todayISO } from "../lib/metrics.js";

/* Applique un plan d'import (aperçu buildPreview) — ÉCRITURES réelles, staff/owner.
   1) créations / mises à jour des joueurs (players) ;
   2) une campagne « Import du <date> » si au moins une ligne porte des tests ;
   3) upsert test_results (datés du jour → comparaison Top 14 + points déjà
      branchés ; MAS m/s synchronisée vers players.mas par saveResultsBulk).
   Les lignes en erreur (action 'error') sont ignorées. */
export async function commitImport(teamId, previewRows, date = todayISO()) {
  const rows = (previewRows || []).filter((r) => r.action === "create" || r.action === "update");
  const results = []; // { playerId, metrics }

  for (const r of rows) {
    let playerId = r.matchId;
    if (r.action === "create") {
      const p = await addPlayer(teamId, { name: r.name, pos: r.pos, grp: r.grp, num: r.num, initials: r.initials });
      playerId = p.id;
      if (r.club) { try { await updatePlayer(playerId, { club: r.club }); } catch { /* non bloquant */ } }
    } else {
      // POSTE CONSERVÉ : on ne met JAMAIS à jour pos/grp d'un joueur existant à
      // l'import (règle produit) — seuls numéro, club et initiales peuvent changer.
      const patch = {};
      if (r.num != null) patch.num = r.num;
      if (r.club) patch.club = r.club;
      if (r.initials) patch.initials = r.initials;
      if (Object.keys(patch).length) await updatePlayer(playerId, patch);
    }
    if (playerId && r.hasData && Object.keys(r.metrics || {}).length) {
      results.push({ playerId, metrics: r.metrics });
    }
  }

  let campaign = null;
  if (results.length) {
    campaign = await createCampaign(teamId, { name: `Import du ${fmtShort(date)}`, date });
    await saveResultsBulk(campaign.id, teamId, results);
  }
  return {
    created: rows.filter((r) => r.action === "create").length,
    updated: rows.filter((r) => r.action === "update").length,
    results: results.length,
    campaign,
  };
}
