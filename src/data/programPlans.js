import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { planDocToSessions, toSessionRows } from "../lib/program/planMaterialize.js";
import { planProgramUpdate } from "./programs.js";
import { assignedIsEmpty, resolveAssignedIds, assignedCoversPlayer } from "./sessions.js";
import { computeProtocolConflicts, removePlayerFromAssigned, addPlayerToAssigned } from "../lib/program/overlap.js";
import { resolvePlayerDoc, applySlotOverrides } from "../lib/program/overrides.js";
import { overridesForDoc, overridesForPlayer } from "./protocolOverrides.js";
import { getProgramDoc } from "./programDocs.js";

// Regroupe des surcharges par joueur : { [playerId]: [override, …] }.
function groupOverridesByPlayer(overrides) {
  const m = {};
  for (const ov of overrides || []) (m[ov.playerId] ||= []).push(ov);
  return m;
}

// Refus explicite : un plan sans destinataire ne doit jamais être publié (sinon,
// avec l'ancien repli, il partait à toute l'équipe). Lève `no-recipients`.
function assertHasRecipients(assigned) {
  if (assignedIsEmpty(assigned)) { const e = new Error("no-recipients"); e.code = "no-recipients"; throw e; }
}

/* ── Règle de NON-SUPERPOSITION entre PROTOCOLES ──────────────────────────────
   Impossible d'assigner deux protocoles qui se chevauchent sur un même joueur.
   (Un programme et un protocole, ou deux programmes, PEUVENT se superposer → ça
   reste un simple avertissement anti-surcharge, non géré ici.) */

// Séances des AUTRES protocoles de l'équipe → { docId, date, ids } (candidat exclu).
async function otherProtocolSessions(teamId, exceptDocId, roster) {
  let q = supabase.from("sessions").select("program_doc_id, date, assigned")
    .eq("team_id", teamId).not("program_doc_id", "is", null);
  if (exceptDocId) q = q.neq("program_doc_id", exceptDocId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ docId: r.program_doc_id, date: r.date, ids: resolveAssignedIds(r.assigned, roster) }));
}

async function docTitleMap(docIds) {
  const ids = [...new Set((docIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await supabase.from("program_docs").select("id, title").in("id", ids);
  const m = {};
  (data ?? []).forEach((d) => { m[d.id] = d.title; });
  return m;
}

/* Applique la règle. Retourne { assigned } (réduit par les exclusions) + `toReplace`
   (couples joueur/protocole dont l'ancien doit être retiré). Lève `protocol-overlap`
   (avec `conflicts`) si un conflit n'est pas résolu par
   `resolution = { replace:[ids], exclude:[ids] }`. Sans `roster` → aucun contrôle. */
async function applyNonOverlap(teamId, { programDocId, start, end, assigned, roster, resolution }) {
  if (!roster?.length || !start || !end) return { assigned, toReplace: [] };
  const targetIds = resolveAssignedIds(assigned, roster);
  const existing = await otherProtocolSessions(teamId, programDocId, roster);
  const conflicts = computeProtocolConflicts({ start, end, targetIds, existing });
  if (!conflicts.length) return { assigned, toReplace: [] };

  const replace = new Set(resolution?.replace || []);
  const exclude = new Set(resolution?.exclude || []);
  const unresolved = conflicts.filter((c) => !replace.has(c.playerId) && !exclude.has(c.playerId));
  if (unresolved.length) {
    const titles = await docTitleMap(unresolved.map((c) => c.docId));
    const e = new Error("protocol-overlap");
    e.code = "protocol-overlap";
    e.conflicts = unresolved.map((c) => ({ ...c, docTitle: titles[c.docId] || "" }));
    throw e;
  }
  let next = assigned;
  for (const pid of exclude) next = removePlayerFromAssigned(next, pid, roster);
  if (assignedIsEmpty(next)) { const e = new Error("no-recipients"); e.code = "no-recipients"; throw e; }
  const toReplace = conflicts.filter((c) => replace.has(c.playerId)).map((c) => ({ playerId: c.playerId, docId: c.docId }));
  return { assigned: next, toReplace };
}

/* « Remplacer l'ancien » : retire un joueur des séances FUTURES NON VALIDÉES d'un
   protocole existant (ses séances validées restent INTACTES). Ligne partagée → on
   retire le joueur de `assigned` ; si plus personne → suppression de la ligne. Met
   aussi à jour l'`assigned` des plans concernés (pas de ré-ajout au replan). */
async function stripPlayerFromProtocolFuture(teamId, docId, playerId, roster, t0) {
  const player = roster.find((p) => p.id === playerId);
  const { data: fut } = await supabase.from("sessions")
    .select("id, assigned").eq("team_id", teamId).eq("program_doc_id", docId).gte("date", t0);
  const rows = (fut ?? []).filter((r) => assignedCoversPlayer(r.assigned, player));
  const ids = rows.map((r) => r.id);
  let logged = new Set();
  if (ids.length) {
    const { data: lg } = await supabase.from("session_logs").select("session_id").in("session_id", ids);
    logged = new Set((lg ?? []).map((r) => r.session_id));
  }
  const toDelete = [];
  for (const r of rows) {
    if (logged.has(r.id)) continue; // JAMAIS toucher une séance validée
    const next = removePlayerFromAssigned(r.assigned, playerId, roster);
    if (next.mode === "none") toDelete.push(r.id);
    else await supabase.from("sessions").update({ assigned: next }).eq("id", r.id);
  }
  if (toDelete.length) await supabase.from("sessions").delete().in("id", toDelete);

  const { data: plans } = await supabase.from("program_plans").select("id, assigned").eq("program_doc_id", docId);
  for (const p of plans ?? []) {
    if (!assignedCoversPlayer(p.assigned, player)) continue;
    await supabase.from("program_plans").update({ assigned: removePlayerFromAssigned(p.assigned, playerId, roster) }).eq("id", p.id);
  }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/* Planifications d'un PROTOCOLE (table program_plans) : une planification fige
   une période + des créneaux + des destinataires et GÉNÈRE des séances datées
   liées (sessions.plan_id / program_doc_id / source_week). Écritures gardées par
   la RLS (owner / staff écrivain de l'équipe). */

export function dbToPlan(r) {
  return {
    id: r.id,
    programDocId: r.program_doc_id,
    teamId: r.team_id,
    startDate: r.start_date,
    weeks: r.weeks,
    slots: Array.isArray(r.slots) ? r.slots : [],
    assigned: r.assigned || { mode: "all" },
    createdAt: r.created_at,
  };
}

/* Crée un plan + génère les séances datées liées. `doc` = protocole complet
   (pour la matérialisation), `slots` = créneaux résolus (weekday choisi). */
export async function createPlan(teamId, { programDocId, doc, startDate, weeks, slots, assigned, roster, resolution }, { today } = {}) {
  assertHasRecipients(assigned);
  const { rows } = planDocToSessions(doc, { startDate, weeks, slots });
  if (!rows.length) { const e = new Error("no-sessions"); e.code = "no-sessions"; throw e; }

  const t0 = today || todayStr();
  // Règle non-superposition : peut lever `protocol-overlap` (à résoudre) ou réduire
  // `assigned` (exclusions). `toReplace` = anciens protocoles à alléger ensuite.
  const { assigned: finalAssigned, toReplace } = await applyNonOverlap(teamId, {
    programDocId, start: rows[0].date, end: rows[rows.length - 1].date, assigned, roster, resolution,
  });

  const { data: plan, error } = await supabase
    .from("program_plans")
    .insert({ program_doc_id: programDocId, team_id: teamId, start_date: startDate, weeks, slots: slots || [], assigned: finalAssigned })
    .select()
    .single();
  if (error) throw error;

  const payload = toSessionRows(rows, { teamId, planId: plan.id, programDocId, assigned: finalAssigned });
  const { error: sErr } = await supabase.from("sessions").insert(payload);
  if (sErr) { await supabase.from("program_plans").delete().eq("id", plan.id); throw sErr; }

  for (const r of toReplace) await stripPlayerFromProtocolFuture(teamId, r.docId, r.playerId, roster, t0);

  // Personnalisation : les destinataires ayant DÉJÀ des surcharges pour ce
  // protocole (d'un plan précédent) reçoivent leurs lignes propres.
  if (roster?.length) {
    const byPlayer = groupOverridesByPlayer(await overridesForDoc(programDocId));
    const planObj = dbToPlan(plan);
    for (const pid of resolveAssignedIds(finalAssigned, roster)) {
      if (byPlayer[pid]?.length) await personalizePlayerInPlan(planObj, doc, byPlayer[pid], roster, pid, t0);
    }
  }
  return { plan: dbToPlan(plan), count: payload.length, replaced: toReplace.length };
}

// Les plans d'un protocole (pour savoir s'il est planifié + répercuter).
export async function plansForDoc(programDocId) {
  const { data, error } = await supabase.from("program_plans").select("*").eq("program_doc_id", programDocId);
  if (error) throw error;
  return (data ?? []).map(dbToPlan);
}

/* ── PERSONNALISATION PAR JOUEUR (socle collectif + surcharges) ────────────────
   Un joueur personnalisé reçoit ses PROPRES lignes de séances (override_player_id
   = lui, assigned = lui seul), générées depuis socle + ses surcharges ; il est
   retiré des lignes COLLECTIVES futures non validées. Ses séances validées et
   celles des AUTRES joueurs ne sont jamais touchées. Idempotent. */

// Séances futures du plan (>= t0) + ensemble des ids loggés (validés).
async function futureRowsWithLogs(planId, t0) {
  const { data: fut } = await supabase.from("sessions")
    .select("id, date, assigned, override_player_id").eq("plan_id", planId).gte("date", t0);
  const rows = fut ?? [];
  let logged = new Set();
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    const { data: lg } = await supabase.from("session_logs").select("session_id").in("session_id", ids);
    logged = new Set((lg ?? []).map((r) => r.session_id));
  }
  return { rows, logged };
}

// Dates (dans ce plan) où le joueur a une séance DÉJÀ validée → à ne pas redoubler.
function loggedDatesForPlayer(rows, logged, player) {
  return new Set(rows.filter((r) => logged.has(r.id) &&
    (r.override_player_id === player.id || (r.override_player_id == null && assignedCoversPlayer(r.assigned, player))))
    .map((r) => r.date));
}

// Personnalise un joueur dans un plan : retire des lignes collectives + (re)génère ses lignes propres.
async function personalizePlayerInPlan(plan, socle, overrides, roster, playerId, t0) {
  const player = roster.find((p) => p.id === playerId);
  if (!player) return;
  const { doc, slotOverrides } = resolvePlayerDoc(socle, overrides);
  const slots = applySlotOverrides(plan.slots, slotOverrides);
  const { rows: gen } = planDocToSessions(doc, { startDate: plan.startDate, weeks: plan.weeks, slots });

  const { rows, logged } = await futureRowsWithLogs(plan.id, t0);
  const skipDates = loggedDatesForPlayer(rows, logged, player);

  // 1) Retirer le joueur des lignes COLLECTIVES futures NON validées qui le couvrent.
  for (const r of rows) {
    if (r.override_player_id != null || logged.has(r.id)) continue;
    if (!assignedCoversPlayer(r.assigned, player)) continue;
    const next = removePlayerFromAssigned(r.assigned, playerId, roster);
    if (next.mode === "none") await supabase.from("sessions").delete().eq("id", r.id);
    else await supabase.from("sessions").update({ assigned: next }).eq("id", r.id);
  }
  // 2) Supprimer ses lignes personnalisées futures NON validées (régénération propre).
  const oldPers = rows.filter((r) => r.override_player_id === playerId && !logged.has(r.id)).map((r) => r.id);
  if (oldPers.length) await supabase.from("sessions").delete().in("id", oldPers);
  // 3) Insérer ses lignes personnalisées (>= t0, hors dates déjà validées).
  const payload = toSessionRows(gen.filter((r) => r.date >= t0 && !skipDates.has(r.date)),
    { teamId: plan.teamId, planId: plan.id, programDocId: plan.programDocId, assigned: { mode: "mix", groups: [], ids: [playerId] }, overridePlayerId: playerId });
  if (payload.length) await supabase.from("sessions").insert(payload);
}

// Reset : re-fusionne un joueur dans les lignes collectives (supprime ses lignes propres).
async function defusePlayerInPlan(plan, socle, roster, playerId, t0) {
  const player = roster.find((p) => p.id === playerId);
  if (!player) return;
  const { rows, logged } = await futureRowsWithLogs(plan.id, t0);

  const pers = rows.filter((r) => r.override_player_id === playerId && !logged.has(r.id)).map((r) => r.id);
  if (pers.length) await supabase.from("sessions").delete().in("id", pers);

  const { rows: gen } = planDocToSessions(socle, { startDate: plan.startDate, weeks: plan.weeks, slots: plan.slots });
  const skipDates = loggedDatesForPlayer(rows, logged, player);
  const sharedByDate = new Map(rows.filter((r) => r.override_player_id == null).map((r) => [r.date, r]));
  const toInsert = [];
  for (const g of gen) {
    if (g.date < t0 || skipDates.has(g.date)) continue;
    const shared = sharedByDate.get(g.date);
    if (shared) {
      if (!assignedCoversPlayer(shared.assigned, player))
        await supabase.from("sessions").update({ assigned: addPlayerToAssigned(shared.assigned, playerId, roster) }).eq("id", shared.id);
    } else toInsert.push(g);
  }
  if (toInsert.length) {
    const payload = toSessionRows(toInsert, { teamId: plan.teamId, planId: plan.id, programDocId: plan.programDocId, assigned: { mode: "mix", groups: [], ids: [playerId] }, overridePlayerId: null });
    await supabase.from("sessions").insert(payload);
  }
}

/* Régénère les séances FUTURES d'un joueur pour un protocole après un changement
   de ses surcharges (appelé par l'UI PR-3 après setOverride / resetOverride).
   Surcharges présentes → personnalisation ; aucune → re-fusion au socle. */
export async function regeneratePlayerSessions(teamId, programDocId, playerId, roster, { today } = {}) {
  const t0 = today || todayStr();
  const [sd, overrides, plans] = await Promise.all([
    getProgramDoc(programDocId), overridesForPlayer(programDocId, playerId), plansForDoc(programDocId),
  ]);
  const socle = sd.doc;
  const has = overrides.length > 0;
  for (const plan of plans) {
    if (!resolveAssignedIds(plan.assigned, roster).includes(playerId)) continue; // plan ne couvre pas ce joueur
    if (has) await personalizePlayerInPlan(plan, socle, overrides, roster, playerId, t0);
    else await defusePlayerInPlan(plan, socle, roster, playerId, t0);
  }
}

/* RÉPERCUSSION — régénère les séances FUTURES d'un plan depuis le protocole/plan
   à jour, en préservant ABSOLUMENT les séances déjà réalisées (loggées) :
   - séances futures non loggées → supprimées puis régénérées (contenu/progression
     à jour) ;
   - séances futures loggées → CONSERVÉES intégralement (contenu + logs), seuls
     leurs DESTINATAIRES sont resynchronisés (comme un changement de ligne) ;
   - le passé (< today) et tout ce qui est loggé ne sont jamais touchés.
   Aucune perte de compliance. Réutilise le moteur planProgramUpdate (PR #193). */
export async function replanFuture(plan, doc, { today, roster } = {}) {
  const t0 = today || todayStr();
  const { rows: expanded } = planDocToSessions(doc, { startDate: plan.startDate, weeks: plan.weeks, slots: plan.slots });

  // Joueurs PERSONNALISÉS de ce protocole (surcharges) : ils ont leurs propres
  // lignes, on les exclut du COLLECTIF. (Sans roster → pas de personnalisation.)
  const byPlayer = groupOverridesByPlayer(roster ? await overridesForDoc(plan.programDocId) : []);
  const personalizedIds = roster
    ? resolveAssignedIds(plan.assigned, roster).filter((id) => byPlayer[id]?.length)
    : [];
  let collectiveAssigned = plan.assigned;
  for (const pid of personalizedIds) collectiveAssigned = removePlayerFromAssigned(collectiveAssigned, pid, roster);

  // On ne gère ici QUE les lignes collectives (override_player_id IS NULL) ; les
  // lignes personnalisées sont régénérées joueur par joueur ensuite.
  const { data: fut, error: fErr } = await supabase.from("sessions")
    .select("id, date").eq("plan_id", plan.id).is("override_player_id", null).gte("date", t0);
  if (fErr) throw fErr;
  const futIds = (fut ?? []).map((r) => r.id);
  let logged = new Set();
  if (futIds.length) {
    const { data: lg } = await supabase.from("session_logs").select("session_id").in("session_id", futIds);
    logged = new Set((lg ?? []).map((r) => r.session_id));
  }

  const { toDelete, keptLoggedIds, toInsert } = planProgramUpdate({ future: fut ?? [], loggedIds: logged, today: t0, expanded });

  if (toDelete.length) {
    const { error: dErr } = await supabase.from("sessions").delete().in("id", toDelete);
    if (dErr) throw dErr;
  }
  // Séances loggées conservées : on propage les destinataires (assigned COMPLET du
  // plan — on ne retire jamais un joueur d'une séance validée = son historique).
  if (keptLoggedIds.length) {
    const { error: uErr } = await supabase.from("sessions").update({ assigned: plan.assigned }).in("id", keptLoggedIds);
    if (uErr) throw uErr;
  }
  // Nouvelles lignes collectives : destinataires SANS les joueurs personnalisés.
  const payload = toSessionRows(toInsert, { teamId: plan.teamId, planId: plan.id, programDocId: plan.programDocId, assigned: collectiveAssigned });
  if (payload.length) {
    const { error: iErr } = await supabase.from("sessions").insert(payload);
    if (iErr) throw iErr;
  }
  // Régénère les lignes des joueurs personnalisés depuis socle + surcharges à jour.
  for (const pid of personalizedIds) await personalizePlayerInPlan(plan, doc, byPlayer[pid], roster, pid, t0);

  return { deleted: toDelete.length, kept: keptLoggedIds.length, inserted: payload.length };
}

/* Répercute une édition du PROTOCOLE sur tous ses plans (séances futures non
   réalisées régénérées). Retourne un récap agrégé. */
export async function replanAllForDoc(programDocId, doc, { today, roster } = {}) {
  const plans = await plansForDoc(programDocId);
  let deleted = 0, kept = 0, inserted = 0;
  for (const plan of plans) {
    const r = await replanFuture(plan, doc, { today, roster });
    deleted += r.deleted; kept += r.kept; inserted += r.inserted;
  }
  return { plans: plans.length, deleted, kept, inserted };
}

/* Édite un plan (période / jours / destinataires) puis répercute sur les séances
   futures non réalisées. `doc` = protocole complet (pour re-matérialiser). */
export async function updatePlan(planId, { startDate, weeks, slots, assigned, roster, resolution }, doc, { today } = {}) {
  assertHasRecipients(assigned);
  const t0 = today || todayStr();
  const { rows } = planDocToSessions(doc, { startDate, weeks, slots });
  const start = rows.length ? rows[0].date : startDate;
  const end = rows.length ? rows[rows.length - 1].date : startDate;

  // Identité du protocole (pour s'exclure de la détection) + équipe.
  const { data: cur, error: cErr } = await supabase.from("program_plans")
    .select("program_doc_id, team_id").eq("id", planId).single();
  if (cErr) throw cErr;

  const { assigned: finalAssigned, toReplace } = await applyNonOverlap(cur.team_id, {
    programDocId: cur.program_doc_id, start, end, assigned, roster, resolution,
  });

  const { data, error } = await supabase.from("program_plans")
    .update({ start_date: startDate, weeks, slots: slots || [], assigned: finalAssigned, updated_at: new Date().toISOString() })
    .eq("id", planId).select().single();
  if (error) throw error;
  const plan = dbToPlan(data);
  const res = await replanFuture(plan, doc, { today: t0, roster });
  for (const r of toReplace) await stripPlayerFromProtocolFuture(cur.team_id, r.docId, r.playerId, roster, t0);
  return { plan, ...res, replaced: toReplace.length };
}

/* Supprime un plan : retire les séances FUTURES NON loggées (≥ today), CONSERVE
   les loggées (détachées : plan_id → null via la FK on delete set null) pour ne
   jamais perdre de compliance. Le passé reste intact. */
export async function deletePlan(planId, { today } = {}) {
  const t0 = today || new Date().toISOString().slice(0, 10);
  const { data: fut, error: fErr } = await supabase.from("sessions").select("id").eq("plan_id", planId).gte("date", t0);
  if (fErr) throw fErr;
  const futIds = (fut ?? []).map((r) => r.id);
  let logged = new Set();
  if (futIds.length) {
    const { data: lg } = await supabase.from("session_logs").select("session_id").in("session_id", futIds);
    logged = new Set((lg ?? []).map((r) => r.session_id));
  }
  const toDel = futIds.filter((id) => !logged.has(id));
  if (toDel.length) {
    const { error: dErr } = await supabase.from("sessions").delete().in("id", toDel);
    if (dErr) throw dErr;
  }
  const { error } = await supabase.from("program_plans").delete().eq("id", planId);
  if (error) throw error;
}

/* Résumé « planifié » par protocole (pour la carte) : dérivé des séances liées.
   Retourne byDoc[program_doc_id] = { count, min, max }. */
export function usePlannedSummary(teamId) {
  const [byDoc, setByDoc] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByDoc({}); return; }
    const { data, error } = await supabase
      .from("sessions")
      .select("program_doc_id, date")
      .eq("team_id", teamId)
      .not("program_doc_id", "is", null);
    if (error) { console.error("[plannedSummary]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => {
      const k = r.program_doc_id;
      if (!m[k]) m[k] = { count: 0, min: r.date, max: r.date };
      m[k].count++;
      if (r.date < m[k].min) m[k].min = r.date;
      if (r.date > m[k].max) m[k].max = r.date;
    });
    setByDoc(m);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { byDoc, refresh: fetch };
}
