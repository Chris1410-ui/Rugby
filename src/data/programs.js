import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { isoDate, parseISO } from "../lib/metrics.js";
import { resolveAssignedIds } from "./sessions.js";

/* Programmes : plage de dates + modèles de séances (par jour de semaine) +
   destinataires. La création MATÉRIALISE des lignes `sessions` (une par
   occurrence de jour dans la plage), pour que le logging joueur fonctionne
   sur des lignes réelles. Suppression → cascade sur les sessions. */

function dbToProgram(r) {
  return {
    id: r.id,
    title: r.title,
    note: r.note,
    start: r.start_date,
    end: r.end_date,
    templates: r.templates || [],
    assigned: r.assigned || { mode: "all" },
    source: r.source || "manuel",
  };
}

export function usePrograms(teamId) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[programs]", error.message); setLoading(false); return; }
    setPrograms((data ?? []).map(dbToProgram));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(`programs:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "programs", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { programs, loading, refresh: fetch };
}

const uid = () => (globalThis.crypto?.randomUUID?.() || `e${Math.random().toString(36).slice(2, 10)}`);
const cleanExos = (exos) =>
  (exos || [])
    .filter((e) => (e.name || "").trim())
    .map((e) => ({ id: e.id || uid(), name: e.name.trim(), sets: e.sets ?? 3, reps: e.reps ?? "8", charge: e.charge ?? "", rest: e.rest ?? 90, video: (e.video || "").trim() }));

/* Développe les modèles (par jour de semaine) sur la plage de dates → lignes
   `sessions` (sans `program_id`, ajouté après insertion du programme).
   Fonction PURE (testable) : une séance par occurrence du jour dans [start,end]. */
export function expandTemplates({ teamId, start, end, templates, assigned }) {
  const s = parseISO(start), e = parseISO(end);
  const out = [];
  if (!(s <= e)) return out; // plage invalide → aucune séance
  (templates || []).forEach((tpl) => {
    const exos = cleanExos(tpl.exercises);
    if (!exos.length) return; // séance sans exercice nommé → ignorée
    let cur = new Date(s);
    while (cur <= e) {
      if (cur.getDay() === Number(tpl.weekday)) {
        out.push({
          team_id: teamId,
          date: isoDate(cur),
          code: tpl.code || "RS",
          nature: tpl.nature || null,
          titre: tpl.titre || "Séance",
          duration_min: 60,
          exercises: exos,
          assigned: assigned || { mode: "all" },
        });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  });
  return out;
}

export async function createProgram(teamId, { title, start, end, assigned, templates, source }) {
  // Matérialise D'ABORD : si aucune séance ne serait générée (dates ne couvrant
  // aucun jour choisi, ou aucun exercice nommé), on échoue AVANT d'insérer le
  // programme — pas de programme orphelin vide.
  const draft = expandTemplates({ teamId, start, end, templates, assigned });
  if (!draft.length) {
    const err = new Error("no-sessions");
    err.code = "no-sessions";
    throw err;
  }

  const { data: prog, error } = await supabase
    .from("programs")
    .insert({ team_id: teamId, title: title.trim(), start_date: start, end_date: end, templates, assigned, source: source || "manuel" })
    .select()
    .single();
  if (error) throw error;

  const sessions = draft.map((row) => ({ ...row, program_id: prog.id }));
  const { error: sErr } = await supabase.from("sessions").insert(sessions);
  if (sErr) {
    // On retire le programme pour ne pas laisser d'entrée sans séances
    await supabase.from("programs").delete().eq("id", prog.id);
    throw sErr;
  }
  return { program: dbToProgram(prog), count: sessions.length };
}

/* Édition d'un programme existant : met à jour l'entrée + RÉ-MATÉRIALISE les
   séances FUTURES (≥ aujourd'hui) depuis les nouveaux modèles/dates. Préserve
   l'historique : les séances passées et les séances futures DÉJÀ loggées ne sont
   pas touchées ; seules les séances futures NON loggées sont remplacées. */
export async function updateProgram(teamId, id, { title, start, end, assigned, templates }, { today } = {}) {
  const t0 = today || isoDate(new Date());

  const { error: uErr } = await supabase
    .from("programs")
    .update({ title: (title || "").trim(), start_date: start, end_date: end, assigned, templates })
    .eq("id", id);
  if (uErr) throw uErr;

  // Séances futures de ce programme (id + date), pour distinguer loggées / non.
  const { data: fut, error: fErr } = await supabase
    .from("sessions").select("id, date").eq("program_id", id).gte("date", t0);
  if (fErr) throw fErr;
  const futIds = (fut ?? []).map((r) => r.id);
  let loggedIds = new Set();
  if (futIds.length) {
    const { data: lg } = await supabase.from("session_logs").select("session_id").in("session_id", futIds);
    loggedIds = new Set((lg ?? []).map((r) => r.session_id));
  }
  const keptDates = new Set((fut ?? []).filter((r) => loggedIds.has(r.id)).map((r) => r.date));
  const toDelete = futIds.filter((sid) => !loggedIds.has(sid));
  if (toDelete.length) {
    const { error: dErr } = await supabase.from("sessions").delete().in("id", toDelete);
    if (dErr) throw dErr;
  }

  // Re-matérialise les occurrences futures (hors dates déjà couvertes par une
  // séance loggée préservée → pas de doublon).
  const rows = expandTemplates({ teamId, start, end, templates, assigned })
    .filter((r) => r.date >= t0 && !keptDates.has(r.date))
    .map((r) => ({ ...r, program_id: id }));
  if (rows.length) {
    const { error: iErr } = await supabase.from("sessions").insert(rows);
    if (iErr) throw iErr;
  }
  return rows.length;
}

export async function deleteProgram(id) {
  const { error } = await supabase.from("programs").delete().eq("id", id); // cascade sessions
  if (error) throw error;
}

export { resolveAssignedIds };
