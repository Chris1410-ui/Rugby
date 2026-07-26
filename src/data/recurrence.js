import { supabase } from "../lib/supabase.js";

/* Séries de récurrence (migration 0090) — table commune à tous les objets
   récurrents (PR-R1 : convocations). L'insertion des OCCURRENCES reste
   spécifique à chaque objet (voir data/trainings.js createTrainingsRecurring),
   mais la SÉRIE (jours/heures/période/exclusions/destinataires/gabarit) est
   centralisée ici. */

export async function createRecurrenceSeries({ teamId, clubId, objectType, value, assigned, payload }) {
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    club_id: clubId || null, team_id: teamId, object_type: objectType,
    weekdays: value.weekdays || [], times: value.times || {},
    period_start: value.start, period_end: value.end, exclusions: value.exclusions || [],
    assigned: assigned || { mode: "all" }, payload: payload || {}, created_by: auth?.user?.id,
  };
  const { data, error } = await supabase.from("recurrence_series").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRecurrenceSeries(seriesId) {
  const { error } = await supabase.from("recurrence_series").delete().eq("id", seriesId);
  if (error) throw error;
}
