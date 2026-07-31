import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";

/* Actualité du club (« mot du staff ») — portée CLUB, lecture directe sous RLS
   (comme la messagerie), realtime. Publication via RPC SECURITY DEFINER
   club_news_publish (contrôle d'accès + fan-out notifications/push optionnel).
   Non-lus = actus plus récentes que l'horodatage « vu » du lecteur. */

const dbToNews = (r) => ({
  id: r.id, teamId: r.team_id, authorUid: r.author_uid, authorLabel: r.author_label,
  kind: r.kind, title: r.title, body: r.body, pinned: r.pinned,
  publishedAt: r.published_at, expiresAt: r.expires_at,
});

export function useClubNews(teamId, limit = 30) {
  const [items, setItems] = useState([]);
  const [seenAt, setSeenAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setItems([]); setLoading(false); return; }
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("club_news").select("*")
      .eq("team_id", teamId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) { console.error("[club_news]", error.message); setLoading(false); return; }
    setItems((data ?? []).map(dbToNews));
    const { data: s } = await supabase.from("club_news_seen").select("seen_at").maybeSingle();
    setSeenAt(s?.seen_at || null);
    setLoading(false);
  }, [teamId, limit]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase.channel(uniqueTopic(`clubnews:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "club_news", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  const unread = items.filter((n) => !seenAt || new Date(n.publishedAt) > new Date(seenAt)).length;
  return { items, unread, loading, refresh: fetch };
}

/* Marque le fil « vu » (horodatage par utilisateur) → remet les non-lus à 0. */
export async function markClubNewsSeen(teamId) {
  if (!teamId) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("club_news_seen").upsert(
    { uid: user.id, team_id: teamId, seen_at: new Date().toISOString() },
    { onConflict: "uid" },
  );
}

/* Publier (staff écrivain / owner) via la RPC : insère + notifie le club si demandé. */
export async function publishClubNews({ title, body, kind = "actu", pinned = false, notify = true, authorLabel = null }) {
  const { data, error } = await supabase.rpc("club_news_publish", {
    p_title: title || null, p_body: body, p_kind: kind, p_pinned: pinned, p_notify: notify, p_author_label: authorLabel,
  });
  if (error) throw error;
  return data;
}

export async function updateClubNews(id, patch = {}) {
  const row = { updated_at: new Date().toISOString() };
  if ("title" in patch) row.title = patch.title || null;
  if ("body" in patch) row.body = patch.body;
  if ("pinned" in patch) row.pinned = patch.pinned;
  if ("kind" in patch) row.kind = patch.kind;
  if ("expiresAt" in patch) row.expires_at = patch.expiresAt || null;
  const { error } = await supabase.from("club_news").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteClubNews(id) {
  const { error } = await supabase.from("club_news").delete().eq("id", id);
  if (error) throw error;
}
