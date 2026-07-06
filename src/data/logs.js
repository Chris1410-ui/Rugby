import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Logs de séance (session_logs). Remplace la clé `logs` du prototype.
   Structure applicative : logs[sessionId][playerId] = {status, rpe, feedback, perExercise}.
   Écriture idempotente par (session_id, player_id) → upsert. RLS : staff = équipe ;
   joueur = ses logs. */

function toMap(rows) {
  const m = {};
  (rows ?? []).forEach((r) => {
    (m[r.session_id] = m[r.session_id] || {})[r.player_id] = {
      status: r.status,
      rpe: r.rpe,
      feedback: r.feedback,
      perExercise: r.per_exercise || {},
    };
  });
  return m;
}

export async function saveLog(sessionId, playerId, { status, rpe, feedback, perExercise }) {
  const { error } = await supabase
    .from("session_logs")
    .upsert(
      {
        session_id: sessionId,
        player_id: playerId,
        status,
        rpe: status === "done" ? rpe : null,
        feedback: feedback || null,
        per_exercise: status === "done" ? perExercise || {} : {},
      },
      { onConflict: "session_id,player_id" }
    );
  if (error) throw error;
}

// Tous les logs visibles (RLS scope automatiquement staff/joueur)
export function useTeamLogs(teamId) {
  const [logs, setLogs] = useState({});

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from("session_logs").select("*");
    if (error) { console.error("[logs]", error.message); return; }
    setLogs(toMap(data));
  }, []);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel(`logs:${teamId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { logs, refresh: fetch };
}
