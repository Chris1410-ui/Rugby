import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { todayISO } from "../lib/metrics.js";

/* Bilans du matin (daily_checkins). Remplace les clés `daily` / `dailyHist`
   du prototype. Écriture idempotente par (player_id, date) → upsert. */

// Ligne DB → forme attendue par enrichPlayers : {wb, sleepH, saved, ...}
function dbToCheckin(row) {
  return {
    date: row.date,
    wb: row.wb,
    sleepH: row.sleep_h != null ? Number(row.sleep_h) : null,
    hydra: row.hydra != null ? Number(row.hydra) : null,
    fc: row.fc,
    hrv: row.hrv,
    poids: row.poids != null ? Number(row.poids) : null,
    activities: row.activities || [],
    createdAt: row.created_at || null,
    saved: true,
  };
}

/* Historique récent des bilans d'UN joueur (vue préparateur détaillée +
   évolution). RLS : staff = son équipe (daily_staff_read) ; joueur = les siens.
   Lecture seule, aucune dérivation d'indicateur ici. */
export function usePlayerCheckins(playerId, days = 21) {
  const [checkins, setCheckins] = useState([]); // du + récent au + ancien
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!playerId) { setCheckins([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("daily_checkins")
      .select("*")
      .eq("player_id", playerId)
      .order("date", { ascending: false })
      .limit(days)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("[player checkins]", error.message);
        setCheckins((data ?? []).map(dbToCheckin));
        setLoading(false);
      });
    return () => { active = false; };
  }, [playerId, days]);

  return { checkins, loading };
}

export async function saveCheckin(playerId, payload, date = todayISO()) {
  const { wb, sleepH, hydra, fc, hrv, poids, activities } = payload;
  const { error } = await supabase
    .from("daily_checkins")
    .upsert(
      { player_id: playerId, date, wb, sleep_h: sleepH, hydra, fc, hrv, poids, activities: activities || [] },
      { onConflict: "player_id,date" }
    );
  if (error) throw error;
}

// Bilan du jour du joueur connecté (pour préremplir / afficher « enregistré »)
export function useMyCheckin(playerId, date = todayISO()) {
  const [checkin, setCheckin] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setLoading(false); return; }
    const { data } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("player_id", playerId)
      .eq("date", date)
      .maybeSingle();
    setCheckin(data ? dbToCheckin(data) : null);
    setLoading(false);
  }, [playerId, date]);

  useEffect(() => { fetch(); }, [fetch]);
  return { checkin, loading, refresh: fetch };
}

/* Dernier bilan par joueur de l'équipe → map { [playerId]: {wb, sleepH, saved} }
   pour alimenter enrichPlayers. RLS : staff = équipe ; joueur = les siens. */
export function useTeamCheckins(playerIds) {
  const key = (playerIds || []).join(",");
  const [byPlayer, setByPlayer] = useState({});
  // Historique d'activités déclarées par joueur → { [pid]: [{date, activities}] }
  // (alimente le classement : +10 pts par thématique, cf. computePoints).
  const [activities, setActivities] = useState({});

  const fetch = useCallback(async () => {
    if (!playerIds || playerIds.length === 0) { setByPlayer({}); setActivities({}); return; }
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("*")
      .in("player_id", playerIds)
      .order("date", { ascending: false });
    if (error) { console.error("[checkins]", error.message); return; }
    const latest = {};
    const act = {};
    (data ?? []).forEach((row) => {
      if (!latest[row.player_id]) latest[row.player_id] = dbToCheckin(row); // 1re = plus récente
      if (Array.isArray(row.activities) && row.activities.length) {
        (act[row.player_id] = act[row.player_id] || []).push({ date: row.date, activities: row.activities });
      }
    });
    setByPlayer(latest);
    setActivities(act);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
    if (!playerIds || playerIds.length === 0) return;
    const channel = supabase
      .channel(`checkins:${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, fetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { checkins: byPlayer, activities, refresh: fetch };
}
