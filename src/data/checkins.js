import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { todayISO, isoDate } from "../lib/metrics.js";
import { uniqueTopic } from "./messages.js";
import { useLocalToday } from "../lib/useLocalToday.js";

/* Bilans du matin (daily_checkins). Remplace les clés `daily` / `dailyHist`
   du prototype. Écriture idempotente par (player_id, date) → upsert. */

// Ligne DB → forme attendue par enrichPlayers : {wb, sleepH, saved, ...}
function dbToCheckin(row) {
  return {
    date: row.date,
    moment: row.moment || "matin",
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

/* Historique des bilans de TOUTE l'équipe sur une fenêtre (écran analytique).
   Renvoie des lignes brutes { playerId, date, wb, sleepH, activities }. Lecture
   seule (RLS daily_staff_read = équipe). Aucune dérivation ici. */
export function useTeamCheckinHistory(playerIds, days = 30) {
  const key = (playerIds || []).join(",");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerIds || playerIds.length === 0) { setRows([]); setLoading(false); return; }
    const from = isoDate(new Date(Date.now() - days * 864e5));
    const { data, error } = await supabase
      .from("daily_checkins").select("player_id, date, moment, wb, sleep_h, activities")
      .in("player_id", playerIds).gte("date", from).order("date", { ascending: true });
    if (error) { console.error("[checkin history]", error.message); setLoading(false); return; }
    // Les lignes « meditation » (séances de relaxation) ne sont pas des bilans → exclues de l'historique.
    setRows((data ?? []).filter((r) => r.moment !== "meditation").map((r) => ({ playerId: r.player_id, date: r.date, moment: r.moment || "matin", wb: r.wb, sleepH: r.sleep_h != null ? Number(r.sleep_h) : null, activities: r.activities || [] })));
    setLoading(false);
  }, [key, days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
    if (!playerIds || playerIds.length === 0) return;
    const ch = supabase
      .channel(uniqueTopic(`ckhist:${key}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [key, days, fetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading };
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
        // Exclut les lignes « meditation » (non-bilan) : la fiche/récap ne montre que matin/soir.
        setCheckins((data ?? []).filter((r) => r.moment !== "meditation").map(dbToCheckin));
        setLoading(false);
      });
    return () => { active = false; };
  }, [playerId, days]);

  return { checkins, loading };
}

export async function saveCheckin(playerId, payload, date = todayISO(), moment = "matin") {
  const { wb, sleepH, hydra, fc, hrv, poids, activities } = payload;
  const row = moment === "soir"
    ? { player_id: playerId, date, moment, wb } // le soir stocke tout dans le jsonb
    : { player_id: playerId, date, moment, wb, sleep_h: sleepH, hydra, fc, hrv, poids, activities: activities || [] };
  const { error } = await supabase
    .from("daily_checkins")
    .upsert(row, { onConflict: "player_id,date,moment" });
  if (error) throw error;
}

/* Bilans du JOUR (matin + soir) du joueur connecté → { matin, soir }. Sert à
   afficher les deux blocs de l'écran Aujourd'hui + leur état « complété ✓ ». */
export function useMyDay(playerId, date = todayISO()) {
  const [day, setDay] = useState({ matin: null, soir: null });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setDay({ matin: null, soir: null }); setLoading(false); return; }
    const { data } = await supabase
      .from("daily_checkins").select("*").eq("player_id", playerId).eq("date", date);
    const map = { matin: null, soir: null };
    (data ?? []).forEach((r) => {
      if (r.moment !== "matin" && r.moment !== "soir" && r.moment != null) return; // ignore « meditation » & co.
      map[r.moment === "soir" ? "soir" : "matin"] = dbToCheckin(r);
    });
    setDay(map);
    setLoading(false);
  }, [playerId, date]);

  useEffect(() => { fetch(); }, [fetch]);
  return { day, loading, refresh: fetch };
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
      .eq("moment", "matin")
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
  const today = useLocalToday(); // bascule à minuit heure locale → re-filtre
  const [byPlayer, setByPlayer] = useState({});
  // Historique d'activités déclarées par joueur → { [pid]: [{date, activities}] }
  // (alimente le classement : +10 pts par thématique, cf. computePoints).
  const [activities, setActivities] = useState({});
  // Bilans complétés par joueur → { [pid]: [{date, moment}] } (+10 chacun, points).
  const [bilans, setBilans] = useState({});

  const fetch = useCallback(async () => {
    if (!playerIds || playerIds.length === 0) { setByPlayer({}); setActivities({}); setBilans({}); return; }
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("*")
      .in("player_id", playerIds)
      .order("date", { ascending: false });
    if (error) { console.error("[checkins]", error.message); return; }
    // Reset 24h : la vue « du jour » (readiness / bien-être / _live) ne retient
    // QUE le bilan daté d'AUJOURD'HUI (date locale de l'appareil). Les jours
    // précédents restent en base (historique) mais ne comptent plus comme bilan
    // du jour → réencodage attendu chaque jour. Bascule auto à minuit local
    // (useLocalToday). L'historique d'activités reste complet (points).
    const latest = {};
    const act = {};
    const bil = {};
    (data ?? []).forEach((row) => {
      const moment = row.moment || "matin";
      // Bilan « du jour » (readiness / _live) = MATIN uniquement (formule inchangée).
      if (row.date === today && moment === "matin" && !latest[row.player_id]) latest[row.player_id] = dbToCheckin(row);
      // Activités déclarées (portées par la ligne matin).
      if (Array.isArray(row.activities) && row.activities.length) {
        (act[row.player_id] = act[row.player_id] || []).push({ date: row.date, activities: row.activities });
      }
      // Événements « bilan complété » (matin + soir) → +10 chacun dans computePoints.
      // La ligne « meditation » N'EST PAS un bilan : on l'exclut ici pour ne pas
      // créditer un +10 « bilan » en double (elle rapporte déjà +10 via l'activité
      // du jour, cf. `act` ci-dessus).
      if (moment === "matin" || moment === "soir") {
        (bil[row.player_id] = bil[row.player_id] || []).push({ date: row.date, moment });
      }
    });
    setByPlayer(latest);
    setActivities(act);
    setBilans(bil);
  }, [key, today]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
    if (!playerIds || playerIds.length === 0) return;
    const channel = supabase
      .channel(`checkins:${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, fetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { checkins: byPlayer, activities, bilans, refresh: fetch };
}

/* ════════════ Méditation / relaxation (gamification, option A) ════════════
   Une séance de relaxation faite AUJOURD'HUI = +10 pts, aligné sur l'« activité
   du jour ». Stockée comme une ligne daily_checkins dédiée (moment='meditation')
   portant l'activité 'meditation' → comptée UNE fois via computePoints (dédup par
   la clé unique player_id,date,moment). N'écrit AUCUN autre champ (wb, sommeil…)
   et est exclue partout du décompte « bilan » → aucun double comptage, aucun
   impact sur readiness/bien-être. Idempotent : une ligne par jour maximum. */
export async function markMeditationDone(playerId, date = todayISO()) {
  if (!playerId) return;
  const { error } = await supabase
    .from("daily_checkins")
    .upsert(
      // wb est NOT NULL → jsonb vide (invisible : la ligne meditation est exclue
      // partout du décompte bilan/readiness).
      { player_id: playerId, date, moment: "meditation", wb: {}, activities: ["meditation"] },
      { onConflict: "player_id,date,moment", ignoreDuplicates: true }
    );
  if (error) throw error;
}

/* Séance de méditation déjà faite aujourd'hui ? (état + rafraîchissement). */
export function useMeditationToday(playerId, date = todayISO()) {
  const [done, setDone] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) { setDone(false); return; }
    const { data, error } = await supabase
      .from("daily_checkins").select("id")
      .eq("player_id", playerId).eq("date", date).eq("moment", "meditation").maybeSingle();
    if (!error) setDone(!!data);
  }, [playerId, date]);

  useEffect(() => { refresh(); }, [refresh]);
  return { done, refresh };
}

/* Construit les events « bilan complété » d'un joueur pour computePoints :
   +10 par bilan (matin/soir), datés. `days` = [{date, moment}]. */
export function bilanEventsOf(days = []) {
  return (days || []).map((b) => ({
    date: b.date,
    label: b.moment === "soir" ? "Bilan du soir complété" : "Bilan du matin complété",
  }));
}
