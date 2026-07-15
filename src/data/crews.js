import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { randomBannerKey } from "../lib/crews.js";

/* Crews : équipes formées par les joueurs. RLS cloisonne strictement par club
   (un joueur ne voit/invite/rejoint que des joueurs de son team_id ; contrainte
   DB composite en plus). Structure applicative :
     crew = { id, teamId, name, banner, createdBy, ownerPlayerId, members:[…] }
     member = { id, crewId, playerId, status:'invited'|'active', invitedBy } */

const dbCrew = (r) => ({
  id: r.id, teamId: r.team_id, name: r.name, banner: r.banner,
  createdBy: r.created_by, ownerPlayerId: r.owner_player_id,
});
const dbMember = (m) => ({
  id: m.id, crewId: m.crew_id, playerId: m.player_id, status: m.status, invitedBy: m.invited_by,
});

export function useCrews(teamId) {
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setCrews([]); setLoading(false); return; }
    const [{ data: cr, error: e1 }, { data: mem, error: e2 }] = await Promise.all([
      supabase.from("crews").select("*").eq("team_id", teamId).order("created_at", { ascending: true }),
      supabase.from("crew_members").select("*"),
    ]);
    if (e1 || e2) { console.error("[crews]", (e1 || e2).message); setLoading(false); return; }
    const byCrew = {};
    (mem ?? []).forEach((m) => { (byCrew[m.crew_id] = byCrew[m.crew_id] || []).push(dbMember(m)); });
    setCrews((cr ?? []).map((c) => ({ ...dbCrew(c), members: byCrew[c.id] || [] })));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(`crews:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "crew_members" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { crews, loading, refresh: fetch };
}

/* Créer un crew : bannière aléatoire, le fondateur devient membre `active`.
   `created_by` doit valoir auth.uid() (policy) → on le lit depuis la session. */
export async function createCrew(teamId, playerId, name) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  const { data, error } = await supabase
    .from("crews")
    .insert({ team_id: teamId, name: name.trim(), banner: randomBannerKey(), created_by: uid, owner_player_id: playerId })
    .select()
    .single();
  if (error) throw error;
  const { error: mErr } = await supabase
    .from("crew_members")
    .insert({ crew_id: data.id, player_id: playerId, team_id: teamId, status: "active", invited_by: playerId });
  if (mErr) { await supabase.from("crews").delete().eq("id", data.id); throw mErr; }
  return dbCrew(data);
}

export async function inviteToCrew(crew, inviterPlayerId, inviteePlayerId) {
  const { error } = await supabase
    .from("crew_members")
    .insert({ crew_id: crew.id, player_id: inviteePlayerId, team_id: crew.teamId, status: "invited", invited_by: inviterPlayerId });
  if (error) throw error;
}

export async function acceptInvite(crewId, myPlayerId) {
  const { error } = await supabase
    .from("crew_members")
    .update({ status: "active" })
    .eq("crew_id", crewId)
    .eq("player_id", myPlayerId);
  if (error) throw error;
}

// Quitter (soi), refuser une invitation (soi) ou exclure un membre (fondateur).
export async function removeMember(crewId, playerId) {
  const { error } = await supabase
    .from("crew_members")
    .delete()
    .eq("crew_id", crewId)
    .eq("player_id", playerId);
  if (error) throw error;
}

export async function dissolveCrew(crewId) {
  const { error } = await supabase.from("crews").delete().eq("id", crewId); // cascade members
  if (error) throw error;
}
