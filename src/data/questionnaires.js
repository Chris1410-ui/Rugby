import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Questionnaires (modèles réutilisables) + assignations par joueur. Le joueur
   soumet via le RPC submit_questionnaire (pas d'écriture directe). Données santé
   sensibles : RLS club stricte (cf. migration 0025). */

const dbToQ = (r) => ({ id: r.id, teamId: r.team_id, nom: r.nom, questions: Array.isArray(r.questions) ? r.questions : [], createdAt: r.created_at });
const dbToA = (r) => ({ questionnaireId: r.questionnaire_id, playerId: r.player_id, statut: r.statut, reponses: r.reponses || {}, sentAt: r.sent_at, filledAt: r.filled_at });

// Modèles du club (staff). Realtime.
export function useTeamQuestionnaires(teamId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setItems([]); setLoading(false); return; }
    const { data, error } = await supabase.from("questionnaires").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) { console.error("[questionnaires]", error.message); setLoading(false); return; }
    setItems((data ?? []).map(dbToQ));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`q:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "questionnaires", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { questionnaires: items, loading, refresh: fetch };
}

/* Assignations du club (staff) → { [questionnaireId]: { [playerId]: assignment } }. */
export function useTeamAssignments(teamId) {
  const [byQ, setByQ] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByQ({}); return; }
    const { data, error } = await supabase.from("questionnaire_assignments").select("*").eq("team_id", teamId);
    if (error) { console.error("[q assignments]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.questionnaire_id] = m[r.questionnaire_id] || {})[r.player_id] = dbToA(r); });
    setByQ(m);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`qa:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "questionnaire_assignments", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { byQuestionnaire: byQ, refresh: fetch };
}

/* Assignations du joueur connecté + les modèles associés (questions). */
export function useMyQuestionnaires(playerId) {
  const [list, setList] = useState([]); // [{ ...assignment, questionnaire }]
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setList([]); setLoading(false); return; }
    const { data: as, error } = await supabase.from("questionnaire_assignments").select("*").eq("player_id", playerId).order("sent_at", { ascending: false });
    if (error) { console.error("[my questionnaires]", error.message); setLoading(false); return; }
    const ids = [...new Set((as ?? []).map((a) => a.questionnaire_id))];
    let qById = {};
    if (ids.length) {
      const { data: qs } = await supabase.from("questionnaires").select("*").in("id", ids);
      qById = Object.fromEntries((qs ?? []).map((q) => [q.id, dbToQ(q)]));
    }
    setList((as ?? []).map((a) => ({ ...dbToA(a), questionnaire: qById[a.questionnaire_id] || null })).filter((x) => x.questionnaire));
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase.channel(uniqueTopic(`myq:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "questionnaire_assignments", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  return { list, loading, refresh: fetch };
}

// ── Écritures (staff) ──
export async function createQuestionnaire(teamId, { nom, questions }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("questionnaires")
    .insert({ team_id: teamId, nom: nom.trim(), questions: questions || [], created_by: auth?.user?.id })
    .select().single();
  if (error) throw error;
  return dbToQ(data);
}
export async function updateQuestionnaire(id, { nom, questions }) {
  const patch = {};
  if (nom != null) patch.nom = nom.trim();
  if (questions != null) patch.questions = questions;
  const { error } = await supabase.from("questionnaires").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteQuestionnaire(id) {
  const { error } = await supabase.from("questionnaires").delete().eq("id", id); // cascade assignments
  if (error) throw error;
}

// Envoi ciblé : crée les assignations (ne réinitialise pas celles déjà remplies).
export async function sendQuestionnaire(questionnaireId, teamId, playerIds) {
  if (!playerIds?.length) return;
  const rows = playerIds.map((pid) => ({ questionnaire_id: questionnaireId, player_id: pid, team_id: teamId, statut: "a_remplir", sent_at: new Date().toISOString() }));
  const { error } = await supabase.from("questionnaire_assignments").upsert(rows, { onConflict: "questionnaire_id,player_id", ignoreDuplicates: true });
  if (error) throw error;
}
export async function unsendAssignment(questionnaireId, playerId) {
  const { error } = await supabase.from("questionnaire_assignments").delete().eq("questionnaire_id", questionnaireId).eq("player_id", playerId);
  if (error) throw error;
}

// Soumission joueur (RPC SECURITY DEFINER).
export async function submitQuestionnaire(questionnaireId, reponses) {
  const { error } = await supabase.rpc("submit_questionnaire", { p_questionnaire: questionnaireId, p_reponses: reponses || {} });
  if (error) throw error;
}

/* Rappel manuel (staff) : notifie (pastille + push) les joueurs n'ayant pas
   rempli. Renvoie le nombre de destinataires relancés (RPC SECURITY DEFINER). */
export async function remindQuestionnaire(questionnaireId) {
  const { data, error } = await supabase.rpc("remind_questionnaire", { p_questionnaire: questionnaireId });
  if (error) throw error;
  return data ?? 0;
}
