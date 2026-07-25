import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { exKey } from "../lib/hevy.js";
import { estimate1RM } from "../lib/oneRM.js";

/* 1RM par joueur (table player_1rm) : saisissable par le staff et le joueur,
   testé ou estimé (Epley), historisé. Écritures gardées par la RLS (joueur =
   les siens ; staff écrivain = son équipe). */

export function dbTo1rm(r) {
  return {
    id: r.id,
    playerId: r.player_id,
    teamId: r.team_id,
    exerciseId: r.exercise_id || null,
    movementKey: r.movement_key,
    movementLabel: r.movement_label || "",
    valueKg: r.value_kg != null ? Number(r.value_kg) : null,
    kind: r.kind || "teste",
    testReps: r.test_reps || null,
    testWeight: r.test_weight != null ? Number(r.test_weight) : null,
    measuredAt: r.measured_at || null,
    source: r.source || null,
    createdAt: r.created_at,
  };
}

// Toutes les entrées 1RM d'un joueur (historique inclus), realtime.
export function usePlayer1RM(playerId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setEntries([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("player_1rm")
      .select("*")
      .eq("player_id", playerId)
      .order("measured_at", { ascending: false, nullsFirst: false });
    if (error) { console.error("[player_1rm]", error.message); setLoading(false); return; }
    setEntries((data ?? []).map(dbTo1rm));
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const channel = supabase
      .channel(`player_1rm:${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_1rm", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playerId, fetch]);

  return { entries, loading, refresh: fetch };
}

/* Ajoute une mesure 1RM. Soit une valeur directe (`valueKg`, kind='teste'), soit
   un sous-max (`testWeight` × `testReps` → 1RM estimé via Epley, kind='estime').
   `name` = libellé du mouvement ; `exerciseId` optionnel (lien bibliothèque). */
export async function add1RM(teamId, playerId, { exerciseId = null, name, valueKg = null, testWeight = null, testReps = null, measuredAt = null, source = "staff", createdBy = null }) {
  const label = String(name || "").trim();
  if (!label) throw new Error("NO_NAME");
  let value = valueKg != null && valueKg !== "" ? Number(valueKg) : null;
  let kind = "teste";
  if (value == null && testWeight && testReps) {
    value = estimate1RM(testWeight, testReps);
    kind = "estime";
  }
  const { data, error } = await supabase
    .from("player_1rm")
    .insert({
      player_id: playerId, team_id: teamId,
      exercise_id: exerciseId,
      movement_key: exKey(label),
      movement_label: label,
      value_kg: value,
      kind,
      test_reps: kind === "estime" ? Number(testReps) : null,
      test_weight: kind === "estime" ? Number(testWeight) : null,
      measured_at: measuredAt || new Date().toISOString().slice(0, 10),
      source, created_by: createdBy,
    })
    .select().single();
  if (error) throw error;
  return dbTo1rm(data);
}

export async function deleteEntry1RM(id) {
  const { error } = await supabase.from("player_1rm").delete().eq("id", id);
  if (error) throw error;
}
