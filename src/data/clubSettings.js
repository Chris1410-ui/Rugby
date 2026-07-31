import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uploadFile, signedUrl } from "./storage.js";

/* Réglages club (photo du hero de l'Accueil). L'image vit dans le bucket privé
   `team-files` (dossier <team_id>/club) → lecture club / écriture staff déjà en
   place. La table club_settings ne stocke que le chemin ; l'URL est signée à la
   lecture. Écriture réservée staff écrivain / owner (RLS). */

export const clubFolder = (teamId) => `${teamId}/club`;

export function useClubSettings(teamId) {
  const [heroUrl, setHeroUrl] = useState(null);
  const [heroPath, setHeroPath] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setHeroUrl(null); setHeroPath(null); setLoading(false); return; }
    const { data } = await supabase.from("club_settings").select("hero_path").eq("team_id", teamId).maybeSingle();
    const path = data?.hero_path || null;
    setHeroPath(path);
    if (path) {
      try { setHeroUrl(await signedUrl(path, 3600)); }
      catch (e) { console.error("[club hero]", e.message); setHeroUrl(null); }
    } else setHeroUrl(null);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { heroUrl, heroPath, loading, refresh: fetch };
}

/* Définit la photo du hero (staff écrivain / owner) : upload + upsert du chemin. */
export async function setClubHero(teamId, file) {
  if (!teamId || !file) return null;
  const path = await uploadFile(clubFolder(teamId), file);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("club_settings").upsert(
    { team_id: teamId, hero_path: path, updated_by: user?.id || null, updated_at: new Date().toISOString() },
    { onConflict: "team_id" },
  );
  if (error) throw error;
  return path;
}
