import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { uploadFile, signedUrl, removeFile } from "./storage.js";
import { extractPdfLines } from "../lib/pdf.js";
import { norm } from "../lib/catalog/detect.js";
import { analyzeReferenceDocAI } from "./referenceDocAI.js";

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

/* ── Analyse IA (PR6) : extraction du texte → Edge Function → candidats ────────
   Le PDF est téléchargé (URL signée), son texte extrait CÔTÉ CLIENT (lib/pdf),
   puis envoyé à la fonction serveur. Les sections-types et conseils renvoyés
   sont persistés en BROUILLON (reference_doc_sections + knowledge_notes), après
   DÉDUP, JAMAIS versés au catalogue automatiquement — la validation manuelle
   reste la garantie. Renvoie un compte-rendu ou { source:"fallback" } si l'IA
   n'est pas configurée / a échoué. */
const sectionKey = (name, kind) => `${norm(name)}|${kind}`;
const noteKey = (theme, title) => `${norm(theme)}|${norm(title)}`;
const pageRefLabel = (title, page) => `${title}${page ? ` · p.${page}` : ""}`;

export async function analyzeReferenceDoc(doc) {
  if (!doc?.storagePath) return { source: "fallback", note: "no_file" };

  // 1) Télécharger le PDF puis en extraire le texte, côté client.
  let text = "";
  try {
    const url = await signedUrl(doc.storagePath, 600);
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], `${doc.title || "doc"}.pdf`, { type: "application/pdf" });
    const lines = await extractPdfLines(file);
    text = lines.join("\n");
  } catch (e) {
    return { source: "fallback", note: "extract_failed", detail: String(e?.message || e) };
  }
  if (!text.trim()) return { source: "fallback", note: "empty_text" };

  // 2) Analyse serveur (clé API jamais exposée).
  const res = await analyzeReferenceDocAI(text, { title: doc.title, theme: doc.theme, filename: doc.title });
  if (res.source !== "claude") return res;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;

  // 3) Persister les candidats en brouillon, avec dédup idempotente.
  const { data: existSec } = await supabase.from("reference_doc_sections").select("dedup_hash").eq("doc_id", doc.id);
  const seenSec = new Set((existSec || []).map((r) => r.dedup_hash).filter(Boolean));
  const secRows = [];
  for (const s of res.sections) {
    const kind = s?.section?.type === "exercises" ? "exercises" : "narrative";
    const key = sectionKey(s?.name || s?.section?.title || "", kind);
    if (seenSec.has(key)) continue;
    seenSec.add(key);
    secRows.push({
      doc_id: doc.id, club_id: doc.clubId, name: (s?.name || s?.section?.title || "").slice(0, 140) || "Section",
      section: s?.section || {}, objective: s?.objective || null,
      equipment: Array.isArray(s?.equipment) ? s.equipment : [], age_category: s?.ageCategory || null,
      confidence: typeof s?.confidence === "number" ? s.confidence : null,
      page_ref: Number.isInteger(s?.pageRef) ? s.pageRef : null,
      status: "draft", dedup_hash: key, fingerprint: s?.section || {},
    });
  }
  if (secRows.length) {
    const { error } = await supabase.from("reference_doc_sections").insert(secRows);
    if (error) console.error("[refdoc sections]", error.message);
  }

  // Conseils → knowledge_notes (brouillon). Dédup par thème + titre normalisés
  // sur les notes existantes du club (toutes origines).
  const { data: existNotes } = await supabase.from("knowledge_notes").select("theme,title");
  const seenNote = new Set((existNotes || []).map((n) => noteKey(n.theme || "", n.title || "")));
  const noteRows = [];
  for (const n of res.notes) {
    const key = noteKey(n?.theme || "", n?.title || "");
    if (!n?.title || seenNote.has(key)) continue;
    seenNote.add(key);
    noteRows.push({
      club_id: doc.clubId, team_id: doc.teamId, theme: n?.theme || null,
      title: String(n.title).slice(0, 200), body: n?.body || null,
      tags: Array.isArray(n?.tags) ? n.tags : [], source: doc.source || null,
      source_ref: pageRefLabel(doc.title, Number.isInteger(n?.pageRef) ? n.pageRef : null),
      origin: "reference_doc", reference_doc_id: doc.id,
      confidence: typeof n?.confidence === "number" ? n.confidence : null,
      shareable: false, status: "draft", created_by: uid,
    });
  }
  if (noteRows.length) {
    const { error } = await supabase.from("knowledge_notes").insert(noteRows);
    if (error) console.error("[refdoc notes]", error.message);
  }

  // 4) Marquer le document analysé.
  await supabase.from("reference_docs").update({ status: "analyzed" }).eq("id", doc.id);

  return {
    source: "claude",
    sectionsAdded: secRows.length, notesAdded: noteRows.length,
    sectionsSkipped: res.sections.length - secRows.length,
    notesSkipped: res.notes.length - noteRows.length,
    warnings: res.warnings, confidence: res.confidence,
  };
}

/* Candidats d'un document (pour l'écran de validation). Sections en brouillon
   ou déjà versées + conseils rattachés au document. */
export function useReferenceDocCandidates(docId) {
  const [sections, setSections] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!docId) { setSections([]); setNotes([]); setLoading(false); return; }
    setLoading(true);
    const [s, n] = await Promise.all([
      supabase.from("reference_doc_sections").select("*").eq("doc_id", docId).order("confidence", { ascending: false }),
      supabase.from("knowledge_notes").select("*").eq("reference_doc_id", docId).order("confidence", { ascending: false }),
    ]);
    setSections((s.data || []).map(dbToSection));
    setNotes((n.data || []).map(dbToNote));
    setLoading(false);
  }, [docId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { sections, notes, loading, refresh: fetch };
}

export function dbToSection(r) {
  return {
    id: r.id, docId: r.doc_id, name: r.name || "", section: r.section || {},
    kind: r.section?.type === "exercises" ? "exercises" : "narrative",
    objective: r.objective || "", equipment: r.equipment || [], ageCategory: r.age_category || "",
    confidence: r.confidence, pageRef: r.page_ref, status: r.status || "draft",
    sectionTemplateId: r.section_template_id || null,
  };
}
export function dbToNote(r) {
  return {
    id: r.id, theme: r.theme || "", title: r.title || "", body: r.body || "",
    tags: r.tags || [], sourceRef: r.source_ref || "", confidence: r.confidence,
    pageRef: null, status: r.status || "draft",
  };
}

/* Versement d'une section candidate → catalogue (section_templates), puis marque
   le candidat comme versé. team_id porte la RLS (owner / staff écrivain du club). */
export async function validateSectionCandidate(cand, teamId) {
  const { data, error } = await supabase.from("section_templates").insert({
    team_id: teamId, name: cand.name || "Section", kind: cand.kind, section: cand.section || {},
  }).select().single();
  if (error) throw error;
  await supabase.from("reference_doc_sections").update({ status: "versée", section_template_id: data.id }).eq("id", cand.id);
  return data;
}
export async function rejectSectionCandidate(cand) {
  const { error } = await supabase.from("reference_doc_sections").delete().eq("id", cand.id);
  if (error) throw error;
}

/* Validation d'un conseil → publication (knowledge_notes.status='published'). */
export async function validateNoteCandidate(note) {
  const { error } = await supabase.from("knowledge_notes").update({ status: "published" }).eq("id", note.id);
  if (error) throw error;
}
export async function rejectNoteCandidate(note) {
  const { error } = await supabase.from("knowledge_notes").delete().eq("id", note.id);
  if (error) throw error;
}
