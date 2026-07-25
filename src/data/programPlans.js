import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { planDocToSessions, toSessionRows } from "../lib/program/planMaterialize.js";

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
export async function createPlan(teamId, { programDocId, doc, startDate, weeks, slots, assigned }) {
  const { rows } = planDocToSessions(doc, { startDate, weeks, slots });
  if (!rows.length) { const e = new Error("no-sessions"); e.code = "no-sessions"; throw e; }

  const { data: plan, error } = await supabase
    .from("program_plans")
    .insert({ program_doc_id: programDocId, team_id: teamId, start_date: startDate, weeks, slots: slots || [], assigned: assigned || { mode: "all" } })
    .select()
    .single();
  if (error) throw error;

  const payload = toSessionRows(rows, { teamId, planId: plan.id, programDocId, assigned });
  const { error: sErr } = await supabase.from("sessions").insert(payload);
  if (sErr) { await supabase.from("program_plans").delete().eq("id", plan.id); throw sErr; }
  return { plan: dbToPlan(plan), count: payload.length };
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
