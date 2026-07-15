import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Campagnes de tests physiques + résultats (historisation par date/camp).
   RLS : campagnes lues par le club, écrites par le staff ; résultats lus par le
   joueur concerné (ou staff), écrits par le staff. Métriques historisées :
   bronco, yoyo, squat_5rm, cmj_overall, bench_5rm, hang_clean_2rm. */

export const TEST_METRICS = [
  { key: "bronco", label: "Bronco", type: "text", unit: "", better: "down" },
  { key: "yoyo", label: "Yo-Yo IR", type: "num", unit: " m", better: "up" },
  { key: "squat_5rm", label: "Squat 5RM", type: "text", unit: "", better: "up" },
  { key: "cmj_overall", label: "CMJ / Overall", type: "num", unit: " cm", better: "up" },
  { key: "bench_5rm", label: "Bench 5RM", type: "num", unit: " kg", better: "up" },
  { key: "hang_clean_2rm", label: "Hang Clean 2RM", type: "num", unit: " kg", better: "up" },
];

const dbCampaign = (r) => ({ id: r.id, teamId: r.team_id, name: r.name, date: r.date });
const dbResult = (r) => ({
  id: r.id, campaignId: r.campaign_id, playerId: r.player_id,
  bronco: r.bronco, yoyo: r.yoyo != null ? Number(r.yoyo) : null,
  squat_5rm: r.squat_5rm,
  cmj_overall: r.cmj_overall != null ? Number(r.cmj_overall) : null,
  bench_5rm: r.bench_5rm != null ? Number(r.bench_5rm) : null,
  hang_clean_2rm: r.hang_clean_2rm != null ? Number(r.hang_clean_2rm) : null,
});

// Campagnes (triées par date croissante) + résultats visibles (RLS scope).
export function useTestCampaigns(teamId) {
  const [campaigns, setCampaigns] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setCampaigns([]); setResults([]); setLoading(false); return; }
    const [{ data: cs, error: e1 }, { data: rs, error: e2 }] = await Promise.all([
      supabase.from("test_campaigns").select("*").eq("team_id", teamId).order("date", { ascending: true }),
      supabase.from("test_results").select("*"),
    ]);
    if (e1 || e2) { console.error("[tests]", (e1 || e2).message); setLoading(false); return; }
    setCampaigns((cs ?? []).map(dbCampaign));
    setResults((rs ?? []).map(dbResult));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(`tests:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "test_campaigns" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "test_results" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { campaigns, results, loading, refresh: fetch };
}

export async function createCampaign(teamId, { name, date }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("test_campaigns")
    .insert({ team_id: teamId, name: name.trim(), date, created_by: auth?.user?.id })
    .select()
    .single();
  if (error) throw error;
  return dbCampaign(data);
}

export async function deleteCampaign(id) {
  const { error } = await supabase.from("test_campaigns").delete().eq("id", id); // cascade results
  if (error) throw error;
}

// Upsert des mesures d'un joueur pour une campagne (clé campaign_id,player_id).
export async function saveResult(campaignId, playerId, teamId, metrics) {
  const { error } = await supabase
    .from("test_results")
    .upsert(
      { campaign_id: campaignId, player_id: playerId, team_id: teamId, ...metrics, updated_at: new Date().toISOString() },
      { onConflict: "campaign_id,player_id" }
    );
  if (error) throw error;
}
