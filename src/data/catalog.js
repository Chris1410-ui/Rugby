import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { extractCandidates, dedupeCandidates } from "../lib/catalog/extract.js";

/* Catalogue de SECTIONS-TYPES (donner/recevoir) — PR1 : club-local.
   « Verser » un protocole extrait ses sections réutilisables, les normalise et
   les dépose comme CANDIDATES (scope='catalog', status='draft') dans le catalogue
   du CLUB, en dédupliquant par hash structurel (mêmes exos + structure = 1 entrée,
   on incrémente l'usage). Aucun partage cross-club à ce stade. */

const nowISO = () => new Date().toISOString();

// club_id de l'équipe (le catalogue est ancré au club, pas à l'équipe).
export async function getClubId(teamId) {
  if (!teamId) return null;
  const { data, error } = await supabase.from("teams").select("club_id").eq("id", teamId).single();
  if (error) { console.error("[catalog club]", error.message); return null; }
  return data?.club_id || null;
}

export function dbToCatalogEntry(r) {
  return {
    id: r.id,
    clubId: r.club_id,
    name: r.name || "",
    kind: r.section_kind || r.kind || "other",
    objective: r.objective || null,
    equipment: Array.isArray(r.equipment) ? r.equipment : [],
    positions: Array.isArray(r.positions) ? r.positions : [],
    durationMin: r.duration_min || null,
    usageCount: r.usage_count || 0,
    reuseCount: r.reuse_count || 0,
    status: r.status || "draft",
    section: r.section && typeof r.section === "object" ? r.section : {},
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  };
}

/* Verse un protocole (doc) au catalogue du club. Retourne un récapitulatif
   { total, created, merged } pour l'affichage. `exerciseIndex` optionnel
   (Map slug→{ref,equipment}) enrichit le matériel/les liens bibliothèque. */
export async function verseDocToCatalog({ clubId, teamId, createdBy = null, doc, exerciseIndex }) {
  if (!clubId) throw new Error("no-club");
  const candidates = dedupeCandidates(extractCandidates(doc, { exerciseIndex }));
  let created = 0, merged = 0;

  for (const c of candidates) {
    // Doublon déjà au catalogue de CE club ? (même hash structurel)
    const { data: existing, error: selErr } = await supabase
      .from("section_templates")
      .select("id, usage_count")
      .eq("club_id", clubId).eq("scope", "catalog").eq("dedup_hash", c.dedupHash)
      .limit(1);
    if (selErr) throw selErr;

    if (existing && existing.length) {
      const cur = existing[0];
      const { error: upErr } = await supabase.from("section_templates")
        .update({ usage_count: (cur.usage_count || 0) + c.occurrences, last_used_at: nowISO(), updated_at: nowISO() })
        .eq("id", cur.id);
      if (upErr) throw upErr;
      merged++;
    } else {
      const { error: insErr } = await supabase.from("section_templates").insert({
        team_id: teamId,
        club_id: clubId,
        origin_club_id: clubId,
        created_by: createdBy,
        name: c.name,
        kind: c.sectionType,          // type structurel (colonne existante)
        section_kind: c.kind,         // type fonctionnel détecté
        section: c.section,
        scope: "catalog",
        status: "draft",
        objective: c.taxonomy.objective,
        equipment: c.taxonomy.equipment,
        positions: c.taxonomy.positions,
        duration_min: c.taxonomy.duration_min,
        dedup_hash: c.dedupHash,
        fingerprint: c.fingerprint,
        usage_count: c.occurrences,
        last_used_at: nowISO(),
      });
      if (insErr) throw insErr;
      created++;
    }
  }
  return { total: candidates.length, created, merged };
}

export async function deleteCatalogEntry(id) {
  const { error } = await supabase.from("section_templates").delete().eq("id", id);
  if (error) throw error;
}

// Liste des candidats du catalogue du club (les plus repris en tête).
export function useClubCatalog(clubId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clubId) { setEntries([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("section_templates")
      .select("*")
      .eq("club_id", clubId).eq("scope", "catalog")
      .order("usage_count", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error("[catalog list]", error.message); setLoading(false); return; }
    setEntries((data ?? []).map(dbToCatalogEntry));
    setLoading(false);
  }, [clubId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refresh: fetch };
}
