import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Messagerie staff ↔ joueur (table messages). Remplace la clé `msg:<playerId>`
   du prototype. `dir` = qui a écrit ('staff' | 'joueur'). `read` = accusé de
   réception. RLS : staff = fils de son équipe ; joueur = son fil. */

function dbToMsg(r) {
  return { id: r.id, dir: r.dir, author: r.author, text: r.text, read: r.read, ts: r.created_at };
}

export async function sendMessage(playerId, { dir, author, text }) {
  const { error } = await supabase
    .from("messages")
    .insert({ player_id: playerId, dir, author: author || null, text: text.trim() });
  if (error) throw error;
}

// Marque comme lus les messages de l'AUTRE partie (accusé de réception)
export async function markRead(playerId, who) {
  const other = who === "staff" ? "joueur" : "staff";
  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("player_id", playerId)
    .eq("dir", other)
    .eq("read", false);
  if (error) console.error("[markRead]", error.message);
}

// Fil d'un joueur (temps réel)
export function useThread(playerId) {
  const [msgs, setMsgs] = useState([]);

  const fetch = useCallback(async () => {
    if (!playerId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: true });
    if (error) { console.error("[thread]", error.message); return; }
    setMsgs((data ?? []).map(dbToMsg));
  }, [playerId]);

  useEffect(() => {
    fetch();
    if (!playerId) return;
    const channel = supabase
      .channel(`messages:${playerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `player_id=eq.${playerId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [playerId, fetch]);

  return { msgs, refresh: fetch };
}

/* Tous les fils de l'équipe (staff) → map { [playerId]: {count, unread, last} }
   pour badges de non-lus + aperçu. RLS scope à l'équipe. Realtime. */
export function useTeamMessages(playerIds) {
  const key = (playerIds || []).join(",");
  const [byPlayer, setByPlayer] = useState({});

  const fetch = useCallback(async () => {
    if (!playerIds || playerIds.length === 0) { setByPlayer({}); return; }
    const { data, error } = await supabase
      .from("messages")
      .select("player_id, dir, text, read, created_at")
      .in("player_id", playerIds)
      .order("created_at", { ascending: true });
    if (error) { console.error("[team messages]", error.message); return; }
    const m = {};
    (data ?? []).forEach((r) => {
      const e = (m[r.player_id] = m[r.player_id] || { count: 0, unread: 0, last: null });
      e.count++;
      if (r.dir === "joueur" && !r.read) e.unread++;
      e.last = r.text;
    });
    setByPlayer(m);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
    if (!playerIds || playerIds.length === 0) return;
    const channel = supabase
      .channel(`team-messages:${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, fetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { threads: byPlayer, refresh: fetch };
}
