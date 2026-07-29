import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";
import { normalizeGpsMetrics, normalizeImages } from "../lib/gps.js";

/* Données GPS (charge externe) — cf. migration 0113. Le joueur gère les siennes ;
   le staff du même club lit (RLS). Images dans le bucket privé `gps-shots`
   (dossier <team_id>/<player_id>/<gps_id>/…), lecture par URL signée. */

export const GPS_BUCKET = "gps-shots";
const bucket = () => supabase.storage.from(GPS_BUCKET);
export const gpsFolder = (teamId, playerId, gpsId) => `${teamId}/${playerId}/${gpsId}`;
export const newGpsId = () => (globalThis.crypto?.randomUUID?.() || `g${Math.random().toString(36).slice(2, 12)}`);

function dbToGps(r) {
  return {
    id: r.id, playerId: r.player_id, teamId: r.team_id, clubId: r.club_id, date: r.date,
    sessionName: r.session_name || null, provider: r.provider || null, source: r.source || "manual",
    linkedSessionId: r.linked_session_id || null, linkedTrainingId: r.linked_training_id || null,
    distanceM: r.distance_m, mPerMin: r.m_per_min, hsrM: r.hsr_m, hsrCount: r.hsr_count,
    vmaxKmh: r.vmax_kmh, vavgKmh: r.vavg_kmh, durationSec: r.duration_sec,
    speedZones: Array.isArray(r.speed_zones) ? r.speed_zones : [],
    imagePaths: Array.isArray(r.image_paths) ? r.image_paths : [],
    images: Array.isArray(r.images) ? r.images : [],
    confidence: r.confidence || {}, nameDetected: !!r.name_detected, notes: r.notes || "",
    createdAt: r.created_at,
  };
}

/* Sessions GPS d'un joueur (le sien, ou celles d'un joueur du club côté staff —
   la RLS filtre). Temps réel. */
export function useGpsSessions(playerId) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!playerId) { setSessions([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("gps_sessions").select("*").eq("player_id", playerId).order("date", { ascending: false });
    if (error) { console.error("[gps]", error.message); setLoading(false); return; }
    setSessions((data ?? []).map(dbToGps));
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const channel = supabase
      .channel(uniqueTopic(`gps:${playerId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "gps_sessions", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playerId, fetch]);

  return { sessions, loading, refresh: fetch };
}

/* Sessions GPS de TOUT le club (staff — la RLS gps_sel autorise le staff de la
   même équipe à lire les lignes de ses joueurs). Temps réel. Sert au parcours
   match / à la galerie club (GPS-5c). Pseudonymisation : l'appelant n'affiche
   jamais le session_name en vue collective (cf. HeatmapsGallery/ClubHeatmaps). */
export function useClubGps(teamId) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setSessions([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("gps_sessions").select("*").eq("team_id", teamId).order("date", { ascending: false });
    if (error) { console.error("[gps club]", error.message); setLoading(false); return; }
    setSessions((data ?? []).map(dbToGps));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(uniqueTopic(`gps-club:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "gps_sessions", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { sessions, loading, refresh: fetch };
}

// Upload des captures vers le bucket privé → chemins stockés. Best-effort par image.
export async function uploadGpsImages(teamId, playerId, gpsId, files) {
  const folder = gpsFolder(teamId, playerId, gpsId);
  const paths = [];
  let i = 0;
  for (const f of files || []) {
    const ext = (f.name?.split(".").pop() || "jpg").toLowerCase();
    const path = `${folder}/${Date.now()}-${i++}.${ext}`;
    const { error } = await bucket().upload(path, f, { upsert: false, contentType: f.type || "image/jpeg" });
    if (error) { console.error("[gps upload]", error.message); continue; }
    paths.push(path);
  }
  return paths;
}

export async function gpsImageUrl(path, expiresIn = 3600) {
  const { data, error } = await bucket().createSignedUrl(path, expiresIn);
  if (error) { console.error("[gps signedUrl]", error.message); return null; }
  return data?.signedUrl || null;
}

export async function removeGpsImages(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  const { error } = await bucket().remove(list);
  if (error) console.error("[gps remove]", error.message);
}

/* Crée une session GPS. `metrics` = entrée IA/manuelle (normalisée ici pour ne
   jamais écrire de valeur fabriquée). `id` optionnel (aligne le dossier images). */
export async function createGpsSession({ id, playerId, teamId, date, metrics = {}, imagePaths = [], images = [], linkedSessionId = null, linkedTrainingId = null, source = "manual" }) {
  const m = normalizeGpsMetrics({ ...metrics, source });
  // Métadonnée d'images (type + onglet) normalisée et alignée sur les chemins
  // réellement stockés — on n'écrit jamais une entrée sans path uploadé.
  const imgs = normalizeImages(images, imagePaths).filter((i) => imagePaths.includes(i.path));
  const row = {
    ...(id ? { id } : {}),
    player_id: playerId, team_id: teamId, date,
    session_name: m.sessionName, provider: m.provider, source: m.source,
    linked_session_id: linkedSessionId, linked_training_id: linkedTrainingId,
    distance_m: m.distanceM, m_per_min: m.mPerMin, hsr_m: m.hsrM, hsr_count: m.hsrCount,
    vmax_kmh: m.vmaxKmh, vavg_kmh: m.vavgKmh, duration_sec: m.durationSec,
    speed_zones: m.speedZones, image_paths: imagePaths, images: imgs, confidence: m.confidence,
    name_detected: m.nameDetected,
  };
  const { data, error } = await supabase.from("gps_sessions").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteGpsSession(gpsId, imagePaths = []) {
  await removeGpsImages(imagePaths);
  const { error } = await supabase.from("gps_sessions").delete().eq("id", gpsId);
  if (error) throw error;
}

/* Agrégats k-anonymes (≥5 joueurs, seuil serveur) : moyennes ligne + équipe par
   métrique → { line: {metric:{avg,n}}, team: {…} }. */
export async function fetchGpsAggregates(days = 90) {
  const [line, team] = await Promise.all([
    supabase.rpc("gps_line_stats", { p_days: days }),
    supabase.rpc("gps_team_stats", { p_days: days }),
  ]);
  const toMap = (res) => {
    const m = {};
    if (res.error) { console.error("[gps stats]", res.error.message); return m; }
    (res.data || []).forEach((r) => { m[r.metric] = { avg: Number(r.avg_val), n: r.n }; });
    return m;
  };
  return { line: toMap(line), team: toMap(team) };
}
