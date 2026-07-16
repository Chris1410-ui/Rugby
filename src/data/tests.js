import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Campagnes de tests physiques + résultats (historisation par date/camp).
   RLS : campagnes lues par le club, écrites par le staff ; résultats lus par le
   joueur concerné (ou staff), écrits par le staff. Métriques historisées :
   bronco, yoyo, squat_5rm, cmj_overall, bench_5rm, hang_clean_2rm. */

export const TEST_METRICS = [
  { key: "mas", label: "MAS", type: "num", unit: " m/s", better: "up" },
  { key: "bronco", label: "Bronco", type: "text", unit: "", better: "down" },
  { key: "yoyo", label: "Yo-Yo IR", type: "num", unit: " m", better: "up" },
  { key: "squat_5rm", label: "Squat 5RM", type: "text", unit: "", better: "up" },
  { key: "bench_5rm", label: "Bench 5RM", type: "num", unit: " kg", better: "up" },
  { key: "deadlift", label: "Deadlift", type: "num", unit: " kg", better: "up" },
  { key: "hang_clean_2rm", label: "Hang Clean 2RM", type: "num", unit: " kg", better: "up" },
  { key: "tractions", label: "Tractions +", type: "num", unit: " kg", better: "up" },
  { key: "cmj_overall", label: "CMJ / Overall", type: "num", unit: " cm", better: "up" },
  { key: "bodyweight", label: "Poids de corps", type: "num", unit: " kg", better: "up" },
];

// MAS saisi en m/s → km/h (×3,6) pour players.mas — une seule vérité MAS.
// Renvoie null si la valeur n'est pas un nombre positif exploitable.
export const masToKmh = (ms) => {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 3.6 * 10) / 10 : null;
};

// Recopie la MAS des résultats (m/s) vers players.mas (km/h). Appelé après
// chaque saisie de tests : la dernière mesure fait foi. Écrit sous l'identité
// staff/owner (RLS players_staff) ; sans MAS valide, ne touche à rien.
async function syncMasToPlayers(rows) {
  const updates = (rows || [])
    .map(({ playerId, metrics }) => ({ playerId, kmh: masToKmh(metrics?.mas) }))
    .filter((u) => u.playerId && u.kmh != null);
  if (!updates.length) return;
  await Promise.all(updates.map((u) => supabase.from("players").update({ mas: u.kmh }).eq("id", u.playerId)));
}

const dbCampaign = (r) => ({ id: r.id, teamId: r.team_id, name: r.name, date: r.date, campId: r.camp_id || null });
const dbResult = (r) => ({
  id: r.id, campaignId: r.campaign_id, playerId: r.player_id,
  mas: r.mas != null ? Number(r.mas) : null,
  bronco: r.bronco, yoyo: r.yoyo != null ? Number(r.yoyo) : null,
  squat_5rm: r.squat_5rm,
  cmj_overall: r.cmj_overall != null ? Number(r.cmj_overall) : null,
  bench_5rm: r.bench_5rm != null ? Number(r.bench_5rm) : null,
  hang_clean_2rm: r.hang_clean_2rm != null ? Number(r.hang_clean_2rm) : null,
  deadlift: r.deadlift != null ? Number(r.deadlift) : null,
  tractions: r.tractions != null ? Number(r.tractions) : null,
  bodyweight: r.bodyweight != null ? Number(r.bodyweight) : null,
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
      .channel(uniqueTopic(`tests:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "test_campaigns" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "test_results" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { campaigns, results, loading, refresh: fetch };
}

/* Statut Top 14 par joueur du club, calculé côté serveur (SECURITY DEFINER) :
   ne renvoie que les tests atteints — jamais les valeurs brutes des coéquipiers.
   Renvoie { [playerId]: [{ key, label, date }] }. Sert au badge + aux points
   (+30) du classement, y compris en vue joueur. */
export function useTeamTop14(teamId) {
  const [byPlayer, setByPlayer] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_top14", { p_team: teamId });
    if (error) { console.error("[team_top14]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { (m[r.player_id] = m[r.player_id] || []).push({ key: r.key, label: r.label, date: r.first_date }); });
    setByPlayer(m);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`t14:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "test_results" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "test_campaigns" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return byPlayer;
}

/* Stats de comparaison de MA ligne (SECURITY DEFINER) : par test, moyenne de la
   ligne, effectif et mon rang — sans aucune valeur individuelle de coéquipier.
   Renvoie { [metric]: { avg, n, rank } }. */
export function useLineStats(playerId) {
  const [stats, setStats] = useState({});

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.rpc("comparison_line_stats");
    if (error) { console.error("[line stats]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => { m[r.metric] = { avg: r.line_avg != null ? Number(r.line_avg) : null, n: r.n, rank: r.my_rank }; });
    setStats(m);
  }, []);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const ch = supabase
      .channel(uniqueTopic(`linestats:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "test_results" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId, fetch]);

  return stats;
}

export async function createCampaign(teamId, { name, date, campId = null }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("test_campaigns")
    .insert({ team_id: teamId, name: name.trim(), date, camp_id: campId, created_by: auth?.user?.id })
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
  await syncMasToPlayers([{ playerId, metrics }]);
}

// Saisie groupée : upsert des mesures de plusieurs joueurs pour une campagne.
// `rows` = [{ playerId, metrics }]. Une seule requête.
export async function saveResultsBulk(campaignId, teamId, rows) {
  if (!rows || rows.length === 0) return;
  const ts = new Date().toISOString();
  const payload = rows.map(({ playerId, metrics }) => ({
    campaign_id: campaignId, player_id: playerId, team_id: teamId, ...metrics, updated_at: ts,
  }));
  const { error } = await supabase
    .from("test_results")
    .upsert(payload, { onConflict: "campaign_id,player_id" });
  if (error) throw error;
  await syncMasToPlayers(rows);
}
