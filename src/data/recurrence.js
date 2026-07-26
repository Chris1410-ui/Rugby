import { supabase } from "../lib/supabase.js";
import { expandRecurrence, planSeriesUpdate } from "../lib/recurrence.js";

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

export async function getRecurrenceSeries(id) {
  const { data, error } = await supabase.from("recurrence_series").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

// Ligne série (DB) → `value` du RecurrenceSelector (mode récurrent).
export function seriesToValue(s) {
  return {
    mode: "recurring", weekdays: s.weekdays || [], times: s.times || {},
    start: s.period_start, end: s.period_end, exclusions: s.exclusions || [],
  };
}

export async function updateRecurrenceSeries(id, { value, assigned, payload }) {
  const patch = {
    weekdays: value.weekdays || [], times: value.times || {},
    period_start: value.start, period_end: value.end, exclusions: value.exclusions || [],
    assigned: assigned || { mode: "all" }, payload: payload || {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("recurrence_series").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteRecurrenceSeries(seriesId) {
  const { error } = await supabase.from("recurrence_series").delete().eq("id", seriesId);
  if (error) throw error;
}

/* Moteur de récurrence GÉNÉRIQUE (un seul, pour éviter la divergence entre
   écrans). Un `adapter` décrit l'objet cible :
   - table       : nom de la table des occurrences ;
   - dateField   : colonne qui porte la date d'occurrence ('date' | 'echeance') ;
   - objectType  : type stocké dans recurrence_series ;
   - buildRow    : (teamId, occ, payload, assigned, uid) → ligne d'insertion ;
   - updatePatch : (time, payload, assigned) → patch des occurrences conservées ;
   - realizedIds : (ids) → Set des occurrences déjà réalisées/validées (protégées).
   Fournit createRecurring / updateSeries / deleteSeries, tous branchés sur les
   helpers purs expandRecurrence + planSeriesUpdate. */
export function makeRecurrenceOps(adapter) {
  const { table, dateField, objectType, buildRow, updatePatch, realizedIds } = adapter;

  async function occurrences(seriesId) {
    const { data: rows, error } = await supabase.from(table).select(`id,${dateField},customized`).eq("series_id", seriesId);
    if (error) throw error;
    const ids = (rows || []).map((r) => r.id);
    const realized = ids.length ? await realizedIds(ids) : new Set();
    return (rows || []).map((r) => ({ id: r.id, date: r[dateField], customized: !!r.customized, hasAttendance: realized.has(r.id) }));
  }

  return {
    async createRecurring({ teamId, clubId, value, assigned, payload }) {
      const { occurrences: occ } = expandRecurrence(value);
      if (!occ.length) throw new Error("no_occurrences");
      const series = await createRecurrenceSeries({ teamId, clubId, objectType, value, assigned, payload });
      const { data: auth } = await supabase.auth.getUser();
      const rows = occ.map((o) => ({ ...buildRow(teamId, o, payload, assigned, auth?.user?.id), series_id: series.id, customized: false }));
      const { error } = await supabase.from(table).insert(rows);
      if (error) { try { await deleteRecurrenceSeries(series.id); } catch { /* best effort */ } throw error; }
      return { seriesId: series.id, count: rows.length };
    },

    async updateSeries(seriesId, teamId, { value, assigned, payload }, { today }) {
      await updateRecurrenceSeries(seriesId, { value, assigned, payload });
      const existing = await occurrences(seriesId);
      const { occurrences: target } = expandRecurrence(value);
      const plan = planSeriesUpdate(existing, target, today);
      if (plan.toDelete.length) {
        const { error } = await supabase.from(table).delete().in("id", plan.toDelete);
        if (error) throw error;
      }
      const { data: auth } = await supabase.auth.getUser();
      if (plan.toInsert.length) {
        const rows = plan.toInsert.map((o) => ({ ...buildRow(teamId, o, payload, assigned, auth?.user?.id), series_id: seriesId, customized: false }));
        const { error } = await supabase.from(table).insert(rows);
        if (error) throw error;
      }
      for (const u of plan.toUpdate) {
        const { error } = await supabase.from(table).update(updatePatch(u.time, payload, assigned)).eq("id", u.id);
        if (error) throw error;
      }
      return { deleted: plan.toDelete.length, inserted: plan.toInsert.length, updated: plan.toUpdate.length };
    },

    async deleteSeries(seriesId, { today }) {
      const existing = await occurrences(seriesId);
      const toDelete = existing.filter((e) => e.date >= today && !e.customized && !e.hasAttendance).map((e) => e.id);
      if (toDelete.length) {
        const { error } = await supabase.from(table).delete().in("id", toDelete);
        if (error) throw error;
      }
      await deleteRecurrenceSeries(seriesId);
      return { deleted: toDelete.length };
    },
  };
}
