import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Modèles de sections ENREGISTRÉS par le staff (table section_templates,
   migration 0065). Partagés au club. Écritures gardées par la RLS (owner /
   staff écrivain du club). Les modèles FOURNIS sont en constantes app
   (lib/program/sectionTemplates.js). */

function dbToTemplate(r) {
  return {
    id: r.id,
    teamId: r.team_id,
    name: r.name || "",
    kind: r.kind,
    section: r.section && typeof r.section === "object" ? r.section : {},
    createdAt: r.created_at,
  };
}

export function useTeamSectionTemplates(teamId) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) { setTemplates([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("section_templates")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[sectionTemplates]", error.message); setLoading(false); return; }
    setTemplates((data ?? []).map(dbToTemplate));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetch();
    if (!teamId) return;
    const channel = supabase
      .channel(`section_templates:${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "section_templates", filter: `team_id=eq.${teamId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId, fetch]);

  return { templates, loading, refresh: fetch };
}

export async function saveSectionTemplate(teamId, { name, kind, section }) {
  const { data, error } = await supabase
    .from("section_templates")
    .insert({ team_id: teamId, name: (name || "").trim(), kind, section })
    .select()
    .single();
  if (error) throw error;
  return dbToTemplate(data);
}

export async function deleteSectionTemplate(id) {
  const { error } = await supabase.from("section_templates").delete().eq("id", id);
  if (error) throw error;
}
