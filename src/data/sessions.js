import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";
import { makeRecurrenceOps } from "./recurrence.js";

/* Séances (sessions). En attendant les programmes complets (étape 7), les séances
   sont des lignes datées directes. `assigned` (jsonb) définit les destinataires. */

// Résout la liste des joueurs assignés à partir de `assigned` + effectif.
// mode 'open' = inscription libre → destinataires = joueurs déjà inscrits (ids).
// mode 'mix'  = COMBINÉ : union(lignes `groups`) ∪ `ids`, dédupliquée (l'ordre et
//               l'unicité viennent du filtrage sur l'effectif).
export function resolveAssignedIds(assigned, roster) {
  if (!assigned || assigned.mode === "all" || !assigned.mode) return roster.map((p) => p.id);
  if (assigned.mode === "group") return roster.filter((p) => p.grp === assigned.group).map((p) => p.id);
  if (assigned.mode === "mix") {
    const groups = new Set(assigned.groups || []);
    const ids = new Set(assigned.ids || []);
    return roster.filter((p) => groups.has(p.grp) || ids.has(p.id)).map((p) => p.id);
  }
  return assigned.ids || []; // 'players' ou 'open'
}

/* Un joueur (grp + id) est-il destinataire de `assigned` ? Réponse SANS l'effectif
   complet (utile pour lister les programmes d'UN joueur). Couvre tous les modes,
   y compris `mix` (union ligne(s) + joueurs). 'open' → non ciblé nominativement. */
export function assignedCoversPlayer(assigned, player) {
  const a = assigned || { mode: "all" };
  if (!a.mode || a.mode === "all") return true;
  if (a.mode === "group") return player?.grp === a.group;
  if (a.mode === "mix") return (a.groups || []).includes(player?.grp) || (a.ids || []).includes(player?.id);
  if (a.mode === "open") return false;
  return (a.ids || []).includes(player?.id); // 'players'
}

/* Construit le jsonb `assigned` depuis une sélection ADDITIVE (sélecteur combiné) :
   - « Toute l'équipe » → {mode:'all'} ;
   - sinon → {mode:'mix', groups, ids} (nettoyé + dédupliqué).
   Repli prudent : rien de sélectionné → {mode:'all'} (personne d'oublié). */
export function buildAssigned({ all = false, groups = [], ids = [] } = {}) {
  const g = [...new Set((groups || []).filter(Boolean))];
  const i = [...new Set((ids || []).filter(Boolean))];
  if (all || (g.length === 0 && i.length === 0)) return { mode: "all" };
  return { mode: "mix", groups: g, ids: i };
}

/* Décompose un `assigned` existant vers la forme du sélecteur (pré-remplissage
   à l'édition). Gère les anciens modes (group/players) → mix équivalent. */
export function assignedToSelection(assigned) {
  const a = assigned || { mode: "all" };
  if (!a.mode || a.mode === "all") return { all: true, groups: [], ids: [] };
  if (a.mode === "group") return { all: false, groups: a.group ? [a.group] : [], ids: [] };
  if (a.mode === "mix") return { all: false, groups: a.groups || [], ids: a.ids || [] };
  return { all: false, groups: [], ids: a.ids || [] }; // players / open
}

// Auto-inscription du joueur connecté à une séance ouverte (mode 'open').
// Passe par une fonction SECURITY DEFINER : le joueur n'écrit jamais sur
// `sessions` directement (voir migration 0020).
export async function enrollInSession(sessionId) {
  const { error } = await supabase.rpc("enroll_in_session", { p_session: sessionId });
  if (error) throw error;
}
export async function leaveSession(sessionId) {
  const { error } = await supabase.rpc("leave_session", { p_session: sessionId });
  if (error) throw error;
}

// Ligne DB → forme attendue par les écrans + le moteur (assignedIds, dur, exercises[])
export function dbToSession(row, roster) {
  return {
    id: row.id,
    programId: row.program_id,
    date: row.date,
    code: row.code || "RS",
    nature: row.nature || null,   // nature descriptive (lib/nature.js) ; repli code-dérivé à l'affichage
    titre: row.titre || "Séance",
    progTitle: row.titre || "Séance",
    dur: row.duration_min || 60,
    exercises: Array.isArray(row.exercises) ? row.exercises : [],
    assigned: row.assigned || { mode: "all" },
    assignedIds: resolveAssignedIds(row.assigned, roster),
    campaignId: row.campaign_id || null, // séance-test → campagne de tests liée (0021)
    origin: row.origin || "staff",        // 'staff' (prescrite) | 'libre' (autonome, 0054) | 'plan' (protocole)
    createdBy: row.created_by || null,
    programDocId: row.program_doc_id || null, // protocole source (séance planifiée)
    sourceWeek: row.source_week || null,       // semaine Sk d'origine
    seriesId: row.series_id || null, customized: !!row.customized, // récurrence (0092)
  };
}

/* Récurrence des séances autonomes (moteur générique partagé). L'occurrence porte
   sa date dans `date` ; le gabarit (titre/code/nature/durée/exercices) vit dans le
   payload de la série. « Réalisée » = au moins un session_logs au-delà de pending
   → l'occurrence est protégée (jamais régénérée ni supprimée). */
const uid = () => (globalThis.crypto?.randomUUID?.() || `e${Math.random().toString(36).slice(2, 10)}`);
const withExoIds = (exercises) => (exercises || []).map((e) => ({
  id: e.id || uid(), name: e.name, sets: e.sets ?? 3, reps: e.reps ?? "8", charge: e.charge ?? "", rest: e.rest ?? 90,
}));
const sessionRow = (teamId, o, p = {}, assigned) => ({
  team_id: teamId, date: o.date, code: p.code || "RS", nature: p.nature || null,
  titre: (p.titre || "").trim() || "Séance", duration_min: p.durationMin || 60,
  exercises: withExoIds(p.exercises), assigned: assigned || { mode: "all" },
});
const sessionRecurrence = makeRecurrenceOps({
  table: "sessions", dateField: "date", objectType: "session",
  buildRow: sessionRow,
  updatePatch: (time, p = {}, assigned) => ({
    code: p.code || "RS", nature: p.nature || null, titre: (p.titre || "").trim() || "Séance",
    duration_min: p.durationMin || 60, exercises: withExoIds(p.exercises), assigned: assigned || { mode: "all" },
  }),
  realizedIds: async (ids) => {
    const { data } = await supabase.from("session_logs").select("session_id,status").in("session_id", ids);
    const s = new Set(); (data || []).forEach((r) => { if (r.status && r.status !== "pending") s.add(r.session_id); });
    return s;
  },
});
export const createSessionsRecurring = (teamId, clubId, args) => sessionRecurrence.createRecurring({ teamId, clubId, ...args });
export const updateSessionSeries = (seriesId, teamId, args, opts) => sessionRecurrence.updateSeries(seriesId, teamId, args, opts);
export const deleteSessionSeries = (seriesId, opts) => sessionRecurrence.deleteSeries(seriesId, opts);

// Lie une séance-test à la campagne de tests qu'elle remplit (créée à la 1re saisie).
export async function linkSessionCampaign(sessionId, campaignId) {
  const { error } = await supabase.from("sessions").update({ campaign_id: campaignId }).eq("id", sessionId);
  if (error) throw error;
}

export function useTeamSessions(teamId, roster) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("team_id", teamId)
      .order("date", { ascending: true });
    if (error) { console.error("[sessions]", error.message); setLoading(false); return; }
    setRows(data ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(uniqueTopic(`sessions:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  // On mappe avec l'effectif courant (assignedIds dépend du roster)
  const sessions = rows.map((r) => dbToSession(r, roster || []));
  return { sessions, loading, refresh: fetch };
}

// Création d'une séance par le staff (précurseur minimal des programmes, étape 7)
export async function createSession(teamId, { date, code, nature, titre, durationMin, exercises, assigned }) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      date,
      code: code || "RS",
      nature: nature || null,
      titre: titre || "Séance",
      duration_min: durationMin || 60,
      exercises: withExoIds(exercises),
      assigned: assigned || { mode: "all" },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Édition d'une séance unique (occurrence d'une série → marquée `customized`).
export async function updateSession(id, { date, code, nature, titre, durationMin, exercises, assigned }, { customized = false } = {}) {
  const patch = {
    ...(date ? { date } : {}), code: code || "RS", nature: nature || null,
    titre: (titre || "").trim() || "Séance", duration_min: durationMin || 60,
    exercises: withExoIds(exercises), assigned: assigned || { mode: "all" },
    ...(customized ? { customized: true } : {}),
  };
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSession(id) {
  const { error } = await supabase.from("sessions").delete().eq("id", id); // cascade logs
  if (error) throw error;
}
