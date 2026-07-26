import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { DEFAULT_ROUTINE_ITEMS, DEFAULT_SHAKE } from "../lib/morningRoutine.js";

/* Routine du matin du staff-athlète (migration 0097). Config (items + shake) et
   journal quotidien sont SELF-ONLY. La 1re ouverture seed la config avec les
   valeurs par défaut (éditables ensuite). Le classement ne lit QUE les dates de
   routine complétée via le RPC public team_routine_points. */

export function useRoutineConfig(playerId, teamId) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setConfig(null); setLoading(false); return; }
    const { data, error } = await supabase.from("athlete_routine").select("*").eq("player_id", playerId).maybeSingle();
    if (error) { console.error("[routine cfg]", error.message); setLoading(false); return; }
    if (data) {
      setConfig({ items: Array.isArray(data.items) ? data.items : [], shake: Array.isArray(data.shake) ? data.shake : [] });
    } else {
      const seed = { items: DEFAULT_ROUTINE_ITEMS(), shake: DEFAULT_SHAKE() };
      if (teamId) { try { await supabase.from("athlete_routine").insert({ player_id: playerId, team_id: teamId, items: seed.items, shake: seed.shake }); } catch { /* seed best effort */ } }
      setConfig(seed);
    }
    setLoading(false);
  }, [playerId, teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { config, loading, refresh: fetch };
}

export async function saveRoutineConfig(playerId, teamId, { items, shake }) {
  const { error } = await supabase.from("athlete_routine")
    .upsert({ player_id: playerId, team_id: teamId, items: items || [], shake: shake || [], updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) throw error;
}

// Journal du jour (date locale de l'appareil, fournie par l'écran).
export function useRoutineLog(playerId, date) {
  const [log, setLog] = useState(null);

  const fetch = useCallback(async () => {
    if (!playerId || !date) { setLog(null); return; }
    const { data, error } = await supabase.from("athlete_routine_log").select("*").eq("player_id", playerId).eq("date", date).maybeSingle();
    if (error) { console.error("[routine log]", error.message); return; }
    setLog(data
      ? { checked: Array.isArray(data.checked) ? data.checked : [], shake: Array.isArray(data.shake) ? data.shake : [], proteinG: data.protein_g, done: !!data.done }
      : { checked: [], shake: [], proteinG: null, done: false });
  }, [playerId, date]);

  useEffect(() => { fetch(); }, [fetch]);
  return { log, refresh: fetch };
}

export async function saveRoutineLog(playerId, teamId, date, { checked, shake, proteinG, done }) {
  const { error } = await supabase.from("athlete_routine_log")
    .upsert({ player_id: playerId, team_id: teamId, date, checked: checked || [], shake: shake || [], protein_g: proteinG ?? null, done: !!done, updated_at: new Date().toISOString() }, { onConflict: "player_id,date" });
  if (error) throw error;
}

// Historique récent (tendance protéines / assiduité), plus récent d'abord.
export function useRoutineHistory(playerId, days = 30) {
  const [rows, setRows] = useState([]);

  const fetch = useCallback(async () => {
    if (!playerId) { setRows([]); return; }
    const { data, error } = await supabase.from("athlete_routine_log").select("date,protein_g,done").eq("player_id", playerId).order("date", { ascending: false }).limit(days);
    if (error) { console.error("[routine hist]", error.message); return; }
    setRows((data || []).map((r) => ({ date: r.date, proteinG: r.protein_g != null ? Number(r.protein_g) : null, done: !!r.done })));
  }, [playerId, days]);

  useEffect(() => { fetch(); }, [fetch]);
  return { rows, refresh: fetch };
}

/* Dates de routine complétée par joueur (club) → alimente le +10 du classement
   (RPC public : ne renvoie que { player_id, date }, jamais le contenu privé). */
export function useTeamRoutinePoints(teamId) {
  const [byPlayer, setByPlayer] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_routine_points", { p_team: teamId });
    if (error) { console.error("[routine points]", error.message); return; }
    const m = {};
    (data || []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ date: r.date }); });
    setByPlayer(m);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return byPlayer;
}
