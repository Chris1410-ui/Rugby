import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { todayISO } from "../lib/metrics.js";
import { uniqueTopic } from "./messages.js";

/* Camps : périodes nommées (date_debut → date_fin) regroupant séances,
   campagnes de tests et inscriptions. RLS : lus par le club, écrits par le
   staff/owner. Les participants sont dans camp_participants (inscrit/présent) ;
   l'auto-inscription joueur est autorisée sur sa propre ligne (statut inscrit). */

const dbCamp = (r) => ({ id: r.id, teamId: r.team_id, nom: r.nom, dateDebut: r.date_debut, dateFin: r.date_fin, createdAt: r.created_at });

// Camp « actif » = celui dont [début, fin] contient aujourd'hui ; sinon le plus
// récent (par date de début). Sert de cible au filtre « depuis le camp ».
export function activeCamp(camps) {
  if (!camps || !camps.length) return null;
  const t = todayISO();
  const current = camps.find((c) => c.dateDebut <= t && t <= c.dateFin);
  if (current) return current;
  return [...camps].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0];
}

// Une séance appartient au camp si sa date tombe dans la fenêtre (dérivé).
export const inCamp = (camp, dateISO) => !!camp && dateISO >= camp.dateDebut && dateISO <= camp.dateFin;

export function useTeamCamps(teamId) {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setCamps([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("camps").select("*").eq("team_id", teamId).order("date_debut", { ascending: false });
    if (error) { console.error("[camps]", error.message); setLoading(false); return; }
    setCamps((data ?? []).map(dbCamp));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`camps:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "camps", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { camps, loading, refresh: fetch };
}

export async function createCamp(teamId, { nom, dateDebut, dateFin }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("camps")
    .insert({ team_id: teamId, nom: nom.trim(), date_debut: dateDebut, date_fin: dateFin, created_by: auth?.user?.id })
    .select().single();
  if (error) throw error;
  return dbCamp(data);
}

export async function updateCamp(id, { nom, dateDebut, dateFin }) {
  const patch = {};
  if (nom != null) patch.nom = nom.trim();
  if (dateDebut != null) patch.date_debut = dateDebut;
  if (dateFin != null) patch.date_fin = dateFin;
  const { error } = await supabase.from("camps").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCamp(id) {
  const { error } = await supabase.from("camps").delete().eq("id", id); // cascade participants ; détache campagnes
  if (error) throw error;
}

/* Participants d'un camp → map { [playerId]: 'inscrit' | 'present' }. Realtime. */
export function useCampParticipants(campId) {
  const [byPlayer, setByPlayer] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!campId) { setByPlayer({}); setLoading(false); return; }
    const { data, error } = await supabase
      .from("camp_participants").select("player_id, statut").eq("camp_id", campId);
    if (error) { console.error("[camp participants]", error.message); setLoading(false); return; }
    const m = {};
    (data ?? []).forEach((r) => { m[r.player_id] = r.statut; });
    setByPlayer(m);
    setLoading(false);
  }, [campId]);

  useEffect(() => {
    fetch();
    if (!campId) return;
    const ch = supabase
      .channel(uniqueTopic(`camp-part:${campId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_participants", filter: `camp_id=eq.${campId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campId, fetch]);

  return { participants: byPlayer, loading, refresh: fetch };
}

/* Inscriptions de TOUS les camps du club (pour compter les inscrits par camp
   dans la liste). RLS staff = équipe. Renvoie { [campId]: nb_inscrits }. */
export function useCampCounts(teamId, campIds) {
  const key = (campIds || []).join(",");
  const [counts, setCounts] = useState({});

  const fetch = useCallback(async () => {
    if (!campIds || !campIds.length) { setCounts({}); return; }
    const { data, error } = await supabase
      .from("camp_participants").select("camp_id").in("camp_id", campIds);
    if (error) { console.error("[camp counts]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { m[r.camp_id] = (m[r.camp_id] || 0) + 1; });
    setCounts(m);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`camp-counts:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_participants" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, key, fetch]);

  return counts;
}

// Inscrire un joueur (staff : n'importe qui de l'équipe ; joueur : lui-même via RLS).
export async function enrollInCamp(campId, playerId, teamId) {
  const { error } = await supabase
    .from("camp_participants")
    .upsert({ camp_id: campId, player_id: playerId, team_id: teamId, statut: "inscrit" }, { onConflict: "camp_id,player_id", ignoreDuplicates: true });
  if (error) throw error;
}

// Pointer présent / revenir à inscrit (staff).
export async function setParticipantStatus(campId, playerId, statut) {
  const { error } = await supabase
    .from("camp_participants").update({ statut }).eq("camp_id", campId).eq("player_id", playerId);
  if (error) throw error;
}

// Désinscrire (staff sur n'importe qui ; joueur sur lui-même via RLS).
export async function removeParticipant(campId, playerId) {
  const { error } = await supabase
    .from("camp_participants").delete().eq("camp_id", campId).eq("player_id", playerId);
  if (error) throw error;
}

/* Inscriptions du joueur connecté (pour l'écran joueur « camps ouverts »).
   Renvoie un Set des campId auxquels il est inscrit. */
export function useMyCampEnrollments(playerId) {
  const [ids, setIds] = useState(new Set());

  const fetch = useCallback(async () => {
    if (!playerId) { setIds(new Set()); return; }
    const { data, error } = await supabase
      .from("camp_participants").select("camp_id").eq("player_id", playerId);
    if (error) { console.error("[my camps]", error.message); return; }
    setIds(new Set((data ?? []).map((r) => r.camp_id)));
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase
      .channel(uniqueTopic(`my-camps:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_participants", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  return { enrolledIds: ids, refresh: fetch };
}
