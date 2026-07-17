import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";
import { detectPlatform } from "../lib/media.js";

/* Médiathèque du club (table `media`, migration 0030). Lecture ouverte à tout le
   club (RLS media_read) ; ajout / suppression réservés au staff/owner. Realtime. */

const dbToMedia = (r) => ({
  id: r.id, teamId: r.team_id, theme: r.theme, titre: r.titre, url: r.url,
  plateforme: r.plateforme, thumbUrl: r.thumb_url, createdAt: r.created_at,
});

export function useTeamMedia(teamId) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setMedia([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("media").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) { console.error("[media]", error.message); setLoading(false); return; }
    setMedia((data ?? []).map(dbToMedia));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`media:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "media", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { media, loading, refresh: fetch };
}

export async function addMedia(teamId, { theme, titre, url, thumbUrl }) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("media").insert({
    team_id: teamId,
    theme: (theme || "").trim() || "Autre",
    titre: (titre || "").trim(),
    url: (url || "").trim(),
    plateforme: detectPlatform(url),
    thumb_url: (thumbUrl || "").trim() || null,
    created_by: auth?.user?.id,
  });
  if (error) throw error;
}

export async function deleteMedia(id) {
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw error;
}
