import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uploadFile, signedUrl, removeFile } from "./storage.js";

/* Documents de référence (« PDF nourriciers », migration 0086). Le PDF est
   stocké dans le bucket privé `team-files` sous <team>/reference/ ; la ligne
   reference_docs porte la provenance (author_owned, source) et la taxonomie,
   en scope club (RLS). L'analyse LLM (sections/conseils candidats) vient en PR6. */

export function dbToRefDoc(r) {
  return {
    id: r.id, clubId: r.club_id, teamId: r.team_id, title: r.title,
    theme: r.theme || "", tags: r.tags || [], objective: r.objective || "",
    period: r.period || "", positions: r.positions || [], ageCategory: r.age_category || "",
    equipment: r.equipment || [], storagePath: r.storage_path || null, source: r.source || "",
    authorOwned: !!r.author_owned, visibility: r.visibility || "club", status: r.status || "uploaded",
    pageCount: r.page_count || null, createdBy: r.created_by, createdAt: r.created_at,
  };
}

// Documents du club (staff), realtime léger sur la table.
export function useReferenceDocs(clubId) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from("reference_docs").select("*").order("created_at", { ascending: false });
    if (error) { console.error("[reference_docs]", error.message); setLoading(false); return; }
    setDocs((data || []).map(dbToRefDoc)); setLoading(false);
  }, [clubId]); // eslint-disable-line react-hooks/exhaustive-deps -- clubId gates the refetch; rows are RLS-scoped to my_club()
  useEffect(() => { fetch(); }, [fetch]);
  return { docs, loading, refresh: fetch };
}

/* Dépôt d'un PDF de référence : upload dans le bucket privé, puis insertion de
   la ligne (provenance obligatoire : author_owned + source). */
export async function uploadReferenceDoc(teamId, clubId, file, meta = {}) {
  if (!meta.authorOwned) throw new Error("author_owned_required");
  const path = await uploadFile(`${teamId}/reference`, file);
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    club_id: clubId, team_id: teamId, title: (meta.title || file.name).trim(),
    theme: meta.theme?.trim() || null, tags: meta.tags || [],
    objective: meta.objective?.trim() || null, period: meta.period?.trim() || null,
    positions: meta.positions || [], age_category: meta.ageCategory?.trim() || null,
    equipment: meta.equipment || [], storage_path: path, source: meta.source?.trim() || null,
    author_owned: true, visibility: "club", status: "uploaded", created_by: auth?.user?.id,
  };
  const { data, error } = await supabase.from("reference_docs").insert(row).select().single();
  if (error) { try { await removeFile(path); } catch { /* best effort */ } throw error; }
  return dbToRefDoc(data);
}

export async function referenceDocUrl(path) {
  if (!path) return null;
  return signedUrl(path, 3600);
}

export async function deleteReferenceDoc(doc) {
  const { error } = await supabase.from("reference_docs").delete().eq("id", doc.id);
  if (error) throw error;
  if (doc.storagePath) { try { await removeFile(doc.storagePath); } catch { /* best effort */ } }
}
