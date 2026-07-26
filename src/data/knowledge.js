import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Base de connaissance — lecture des conseils PUBLIÉS (knowledge_notes). Sert
   l'assistance contextuelle à la création de protocoles : chaque conseil porte
   sa citation source (source_ref = « titre du document · p.N »). La RLS borne
   déjà la lecture au catalogue global + aux notes du club ; on ne remonte ici
   que celles au statut `published` (les brouillons issus de l'analyse IA restent
   invisibles tant qu'ils ne sont pas validés). */

export function dbToKnowledgeNote(r) {
  return {
    id: r.id, theme: r.theme || "", title: r.title || "", body: r.body || "",
    tags: r.tags || [], sourceRef: r.source_ref || "", source: r.source || "",
    confidence: r.confidence, referenceDocId: r.reference_doc_id || null,
    origin: r.origin || "manual",
  };
}

export function usePublishedKnowledge() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("knowledge_notes").select("*")
      .eq("status", "published")
      .order("confidence", { ascending: false });
    if (error) { console.error("[knowledge_notes]", error.message); setLoading(false); return; }
    setNotes((data || []).map(dbToKnowledgeNote));
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { notes, loading, refresh: fetch };
}
