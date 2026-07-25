import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uniqueTopic } from "./messages.js";
import { normalizeProgram, clampWeeks, emptyProgram } from "../lib/program/model.js";

/* Couche données des PROTOCOLES (programmes d'entraînement riches). Distincte de
   `programs` (planning weekday→sessions). Écritures directes en table, gardées
   par la RLS de `program_docs` (owner / staff écrivain de son club). Le contenu
   riche est toujours normalisé au passage (forme stable, grilles au bon nombre
   de semaines). */

export function dbToDoc(r) {
  const weeks = clampWeeks(r.weeks);
  return {
    id: r.id,
    teamId: r.team_id,
    title: r.title || "",
    category: r.category || "",
    status: r.status || "draft",
    weeks,
    doc: normalizeProgram(r.doc, weeks),
    source: r.source || "app",
    reviewed: r.reviewed !== false,
    createdBy: r.created_by || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Liste (métadonnées seules, sans le gros JSONB) + realtime, comme usePrograms.
export function useProgramDocs(teamId) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setDocs([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("program_docs")
      .select("id, team_id, title, category, status, weeks, source, reviewed, created_by, created_at, updated_at")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false });
    if (error) { console.error("[programDocs]", error.message); setLoading(false); return; }
    setDocs((data ?? []).map((r) => ({
      id: r.id, teamId: r.team_id, title: r.title || "", category: r.category || "",
      status: r.status || "draft", weeks: clampWeeks(r.weeks),
      source: r.source || "app", reviewed: r.reviewed !== false,
      createdBy: r.created_by || null, createdAt: r.created_at, updatedAt: r.updated_at,
    })));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(uniqueTopic(`program_docs:${teamId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "program_docs", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { docs, loading, refresh: fetch };
}

// Charge un protocole complet (avec son contenu `doc`).
export async function getProgramDoc(id) {
  const { data, error } = await supabase.from("program_docs").select("*").eq("id", id).single();
  if (error) throw error;
  return dbToDoc(data);
}

export async function createProgramDoc(teamId, { title = "", category = "", weeks = 4, doc, status = "draft", source = "app", reviewed } = {}) {
  const w = clampWeeks(weeks);
  const content = normalizeProgram(doc || emptyProgram(w), w);
  // Un protocole importé de PDF est « à vérifier » par défaut (reviewed=false),
  // sauf indication contraire ; un protocole créé dans l'app est déjà relu.
  const rev = reviewed != null ? reviewed : source !== "pdf";
  const { data, error } = await supabase
    .from("program_docs")
    .insert({ team_id: teamId, title: title.trim(), category: category.trim(), weeks: w, status, doc: content, source, reviewed: rev })
    .select()
    .single();
  if (error) throw error;
  return dbToDoc(data);
}

// Marque un protocole comme relu (retire l'indicateur « importé — à vérifier »).
export async function markProgramDocReviewed(id) {
  const { error } = await supabase.from("program_docs").update({ reviewed: true }).eq("id", id);
  if (error) throw error;
}

export async function updateProgramDoc(id, patch = {}) {
  const upd = {};
  if (patch.title != null) upd.title = String(patch.title).trim();
  if (patch.category != null) upd.category = String(patch.category).trim();
  if (patch.status != null) upd.status = patch.status;
  if (patch.weeks != null) upd.weeks = clampWeeks(patch.weeks);
  if (patch.doc != null) upd.doc = normalizeProgram(patch.doc, upd.weeks ?? clampWeeks(patch.weeks ?? patch.doc?.meta?.weeks));
  const { data, error } = await supabase.from("program_docs").update(upd).eq("id", id).select().single();
  if (error) throw error;
  return dbToDoc(data);
}

export async function setProgramStatus(id, published) {
  return updateProgramDoc(id, { status: published ? "published" : "draft" });
}

export async function deleteProgramDoc(id) {
  const { error } = await supabase.from("program_docs").delete().eq("id", id);
  if (error) throw error;
}
