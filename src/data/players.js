import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Mappe une ligne DB `players` → la forme camelCase attendue par le moteur
   métier (lib/metrics.js). Les valeurs seed alimentent le moteur de charge/risque. */
export function dbToPlayer(row) {
  return {
    id: row.id,
    team: row.team_id,
    ownerUid: row.owner_uid,
    num: row.num,
    name: row.name,
    pos: row.pos,
    grp: row.grp,
    club: row.club,
    age: row.age,
    acwr: Number(row.acwr_seed ?? 1.0),
    wellness: row.wellness ?? 35,
    sleep: Number(row.sleep_h ?? 7.5),
    risque: row.risque ?? 30,
    charge7j: row.charge7j ?? 1800,
    dispo: row.dispo ?? 90,
    mas: row.mas,
    backSquat: Number(row.back_squat ?? 1.2),
    cmjG: row.cmj_g,
    cmjD: row.cmj_d,
    ischiosG: row.ischios_g ?? 300,
    ischiosD: row.ischios_d ?? 300,
    asym: row.asym ?? 0,
    bronco: row.bronco ?? null,
    yoyo: row.yoyo != null ? Number(row.yoyo) : null,
    squat5rm: row.squat_5rm ?? null,
    cmjOverall: row.cmj_overall != null ? Number(row.cmj_overall) : null,
    bench5rm: row.bench_5rm != null ? Number(row.bench_5rm) : null,
    hangClean2rm: row.hang_clean_2rm != null ? Number(row.hang_clean_2rm) : null,
    ppNotes: row.pp_notes ?? null,
    isCustom: row.is_custom,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

/* Liste de l'effectif d'une équipe, triée (num puis nom) pour un affichage
   stable — un ajout ne « disparaît » pas en bas de liste (cf. MIGRATION §4).
   S'abonne au Realtime : tout ajout/màj est reflété en direct chez le staff. */
export function useRoster(teamId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoster = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const sorted = (data ?? [])
      .map(dbToPlayer)
      .sort((a, b) => (a.num ?? 999) - (b.num ?? 999) || a.name.localeCompare(b.name));
    setPlayers(sorted);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchRoster();
    if (!teamId) return;
    const channel = supabase
      .channel(`players:${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `team_id=eq.${teamId}` },
        () => fetchRoster()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchRoster]);

  return { players, loading, error, refresh: fetchRoster };
}

/* Liste plate de l'effectif d'un club (réels + démo) pour le sélecteur
   « Vue joueur » de l'owner — lecture seule, triée num puis nom. Les joueurs de
   démo sont marqués pour être distingués visuellement dans le sélecteur. */
export async function fetchTeamPlayers(teamId) {
  const { data, error } = await supabase
    .from("players").select("id, name, pos, grp, num, is_demo").eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []).sort((a, b) => (a.num ?? 999) - (b.num ?? 999) || a.name.localeCompare(b.name));
}

/* Ajout d'un joueur par le staff (RLS players_staff). */
export async function addPlayer(teamId, { name, pos, grp, num }) {
  const { data, error } = await supabase
    .from("players")
    .insert({ team_id: teamId, name: name.trim(), pos, grp, num: num || null })
    .select()
    .single();
  if (error) throw error;
  return dbToPlayer(data);
}

/* Mise à jour d'un joueur (staff). `patch` en colonnes DB (snake_case). */
export async function updatePlayer(id, patch) {
  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) throw error;
}
