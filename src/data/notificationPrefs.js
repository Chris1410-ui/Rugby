import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Préférences de rappels du joueur (notification_prefs, migration 0123). Le
   joueur lit/écrit UNIQUEMENT sa ligne (RLS self). Le dispatcher côté base
   (notify_reminders, pg_cron) crée les rappels dus → pastille in-app + push. */

const DEFAULTS = {
  enabled: true,
  morning_time: "08:00",
  evening_time: "20:00",
  streak_guard: true,
  quiet_start: null,
  quiet_end: null,
  tone: "normal",
};

// "08:00:00" → "08:00" (le <input type=time> ne veut pas les secondes).
const hm = (v) => (typeof v === "string" ? v.slice(0, 5) : v);

function dbToPrefs(row) {
  if (!row) return { ...DEFAULTS };
  return {
    enabled: row.enabled,
    morning_time: hm(row.morning_time) || DEFAULTS.morning_time,
    evening_time: hm(row.evening_time) || DEFAULTS.evening_time,
    streak_guard: row.streak_guard,
    quiet_start: hm(row.quiet_start) || null,
    quiet_end: hm(row.quiet_end) || null,
    tone: row.tone || "normal",
  };
}

export function useNotificationPrefs(playerId, teamId) {
  const [prefs, setPrefs] = useState({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    if (!playerId) { setPrefs({ ...DEFAULTS }); setLoading(false); return; }
    const { data, error } = await supabase
      .from("notification_prefs").select("*").eq("player_id", playerId).maybeSingle();
    if (error) console.error("[notification_prefs]", error.message);
    setPrefs(dbToPrefs(data));
    setLoading(false);
  }, [playerId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Upsert idempotent (clé = player_id). team_id requis par la policy with-check.
  const save = useCallback(async (next) => {
    if (!playerId || !teamId) return;
    setSaving(true);
    setPrefs(next); // optimiste
    const row = {
      player_id: playerId,
      team_id: teamId,
      enabled: next.enabled,
      morning_time: next.morning_time,
      evening_time: next.evening_time,
      streak_guard: next.streak_guard,
      quiet_start: next.quiet_start || null,
      quiet_end: next.quiet_end || null,
      tone: next.tone,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("notification_prefs").upsert(row, { onConflict: "player_id" });
    if (error) console.error("[notification_prefs save]", error.message);
    setSaving(false);
  }, [playerId, teamId]);

  return { prefs, loading, saving, save, refresh: fetch };
}
