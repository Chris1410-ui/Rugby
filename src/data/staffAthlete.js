import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { isoDate } from "../lib/metrics.js";
import { createProgram } from "./programs.js";
import { REF_TEMPLATES } from "../lib/referenceProtocol.js";

/* Profil athlète du staff (migration 0096). Un compte staff active (opt-in) une
   carte `players` dédiée dans son club → il se suit et concourt au classement à
   égalité avec les joueurs. Ses données privées restent self-only (RLS 0096).
   Idempotent : renvoie l'id de la carte (existante ou nouvellement créée). */
/* Active le profil athlète. `team` optionnel : pour l'OWNER (multi-clubs), le club
   de rattachement du profil athlète ; pour le staff, ignoré (sa propre équipe). */
export async function activateStaffAthlete(team) {
  const { data, error } = await supabase.rpc("activate_staff_athlete", team ? { p_team: team } : {});
  if (error) throw error;
  return data; // players.id de la carte athlète
}

/* Désactive le profil athlète (réversible, migration 0117) : délie le profil et
   passe la carte en 'inactive' (retirée de l'effectif/classement). Historique
   conservé → réactiver réutilise la même carte. */
export async function deactivateStaffAthlete() {
  const { error } = await supabase.rpc("deactivate_staff_athlete");
  if (error) throw error;
}

/* Projection PUBLIQUE des staff-athlètes d'un club (RPC SECURITY DEFINER, 0098) :
   par athlète { sessions_done, natures {nature: n}, routine_today }. C'est TOUT ce
   qu'un joueur voit d'eux (avec points/badges du classement) — jamais les charges,
   tests, poids, bilans ni le contenu de la routine. Indexé par player_id. */
export function useTeamAthletePublic(teamId) {
  const [byPlayer, setByPlayer] = useState({});

  const fetch = useCallback(async () => {
    if (!teamId) { setByPlayer({}); return; }
    const { data, error } = await supabase.rpc("team_athlete_public", { p_team: teamId });
    if (error) { console.error("[athlete public]", error.message); return; }
    const m = {};
    (data || []).forEach((r) => {
      m[r.player_id] = { sessionsDone: r.sessions_done || 0, natures: r.natures || {}, routineToday: !!r.routine_today };
    });
    setByPlayer(m);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);
  return byPlayer;
}

// Décalage de N jours d'une date ISO (jour local, sans dérive de fuseau).
function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/* Pré-charge le PROTOCOLE DE RÉFÉRENCE comme programme personnel du staff-athlète
   (séances matérialisées sur 4 semaines, éditables ensuite comme n'importe quel
   programme). Idempotent : si un programme « référence » existe déjà pour cet
   athlète, on ne recrée rien. `today` fourni par l'écran (date locale). */
export async function seedReferenceProtocol(teamId, playerId, today) {
  const t0 = today || isoDate(new Date());
  // Déjà chargé ? (programme source=reference destiné à ce joueur)
  const { data: existing } = await supabase
    .from("programs").select("id, assigned").eq("team_id", teamId).eq("source", "reference");
  const already = (existing || []).some((p) => (p.assigned?.ids || []).includes(playerId));
  if (already) return { skipped: true };

  const res = await createProgram(teamId, {
    title: "Protocole de référence",
    start: t0,
    end: addDays(t0, 27), // 4 semaines
    assigned: { mode: "players", ids: [playerId] },
    templates: REF_TEMPLATES,
    source: "reference",
  });
  return { skipped: false, count: res.count };
}
