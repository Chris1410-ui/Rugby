import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";
import { todayISO } from "../lib/metrics.js";

/* Statut de traitement des alertes (file + historique). Les alertes sont
   calculées en direct (buildAlerts) ; cette couche stocke leur traitement
   (transmise kiné / traitée) avec un snapshot → historique auto-suffisant.
   RLS : staff de l'équipe + owner. */

// La colonne `txt` porte désormais les PARAMS de l'alerte (JSON), plus aucune
// prose : le libellé est reconstruit dans la langue du lecteur via alertText.
// Les lignes antérieures (prose FR) sont détectées et servies telles quelles.
const parseParams = (s) => {
  if (typeof s !== "string" || s[0] !== "{") return null;
  try { return JSON.parse(s); } catch { return null; }
};
const dbRow = (r) => ({
  id: r.id, teamId: r.team_id, playerId: r.player_id, date: r.date,
  cat: r.cat, akey: r.akey, txt: r.txt, params: parseParams(r.txt), sev: r.sev, icon: r.icon,
  kineAt: r.kine_at, treatedAt: r.treated_at,
});

export function useAlertStatus(teamId) {
  const [statuses, setStatuses] = useState([]);

  const fetch = useCallback(async () => {
    if (!teamId) { setStatuses([]); return; }
    const { data, error } = await supabase
      .from("alert_status").select("*").eq("team_id", teamId).order("date", { ascending: false });
    if (error) { console.error("[alert_status]", error.message); return; }
    setStatuses((data ?? []).map(dbRow));
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const ch = supabase
      .channel(uniqueTopic(`alerts:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_status" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, fetch]);

  return { statuses, refresh: fetch };
}

// Upsert du statut (joueur, type, aujourd'hui). `patch` pose kine_at / treated_at ;
// les colonnes non fournies conservent leur valeur (kiné + traité cumulables).
async function upsertStatus(teamId, alert, patch) {
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    team_id: teamId, player_id: alert.pid, date: todayISO(),
    // `txt` stocke les params (JSON), pas de prose → snapshot i18n-neutre.
    cat: alert.cat, akey: alert.key, txt: JSON.stringify(alert.params || {}), sev: alert.sev, icon: alert.icon,
    created_by: auth?.user?.id, ...patch,
  };
  const { error } = await supabase.from("alert_status").upsert(row, { onConflict: "player_id,akey,date" });
  if (error) throw error;
}

export const markKine = (teamId, alert) => upsertStatus(teamId, alert, { kine_at: new Date().toISOString() });
export const markTreated = (teamId, alert) => upsertStatus(teamId, alert, { treated_at: new Date().toISOString() });

// Réactiver une alerte traitée (efface treated_at → revient dans la file).
export async function reopenAlert(id) {
  const { error } = await supabase.from("alert_status").update({ treated_at: null }).eq("id", id);
  if (error) throw error;
}
