import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { planDocToSessions, toSessionRows } from "../lib/program/planMaterialize.js";
import { planProgramUpdate } from "./programs.js";
import { assignedIsEmpty, resolveAssignedIds, assignedCoversPlayer } from "./sessions.js";
import { computeProtocolConflicts, removePlayerFromAssigned } from "../lib/program/overlap.js";

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
  return { plan: dbToPlan(plan), count: payload.length, replaced: toReplace.length };
}

// Les plans d'un protocole (pour savoir s'il est planifié + répercuter).
export async function plansForDoc(programDocId) {
  const { data, error } = await supabase.from("program_plans").select("*").eq("program_doc_id", programDocId);
  if (error) throw error;
  return (data ?? []).map(dbToPlan);
}

/* RÉPERCUSSION — régénère les séances FUTURES d'un plan depuis le protocole/plan
   à jour, en préservant ABSOLUMENT les séances déjà réalisées (loggées) :
   - séances futures non loggées → supprimées puis régénérées (contenu/progression
     à jour) ;
   - séances futures loggées → CONSERVÉES intégralement (contenu + logs), seuls
     leurs DESTINATAIRES sont resynchronisés (comme un changement de ligne) ;
   - le passé (< today) et tout ce qui est loggé ne sont jamais touchés.
   Aucune perte de compliance. Réutilise le moteur planProgramUpdate (PR #193). */
export async function replanFuture(plan, doc, { today } = {}) {
  const t0 = today || todayStr();
  const { rows: expanded } = planDocToSessions(doc, { startDate: plan.startDate, weeks: plan.weeks, slots: plan.slots });

  const { data: fut, error: fErr } = await supabase.from("sessions").select("id, date").eq("plan_id", plan.id).gte("date", t0);
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
  // Séances loggées conservées : on propage seulement les destinataires du plan.
  if (keptLoggedIds.length) {
    const { error: uErr } = await supabase.from("sessions").update({ assigned: plan.assigned }).in("id", keptLoggedIds);
    if (uErr) throw uErr;
  }
  const payload = toSessionRows(toInsert, { teamId: plan.teamId, planId: plan.id, programDocId: plan.programDocId, assigned: plan.assigned });
  if (payload.length) {
    const { error: iErr } = await supabase.from("sessions").insert(payload);
    if (iErr) throw iErr;
  }
  return { deleted: toDelete.length, kept: keptLoggedIds.length, inserted: payload.length };
}

/* Répercute une édition du PROTOCOLE sur tous ses plans (séances futures non
   réalisées régénérées). Retourne un récap agrégé. */
export async function replanAllForDoc(programDocId, doc, { today } = {}) {
  const plans = await plansForDoc(programDocId);
  let deleted = 0, kept = 0, inserted = 0;
  for (const plan of plans) {
    const r = await replanFuture(plan, doc, { today });
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
  const res = await replanFuture(plan, doc, { today: t0 });
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
