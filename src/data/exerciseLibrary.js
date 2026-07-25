import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* Bibliothèque d'exercices (table `exercise_library`, migration 0053).
   Catalogue global MIT (team_id null) + exos custom d'un club. Lecture par tout
   membre authentifié (RLS exlib_read). DONNÉES SEULES : aucun média hébergé
   (thumb_url/gif_url null, © Gym visual). Requêtes paginées côté serveur. */

export const PAGE_SIZE = 20;

// Slug d'une valeur de facette (« body weight » → « body_weight ») pour la clé
// i18n data.ex*.*. Le libellé traduit ne change JAMAIS la valeur stockée : les
// filtres SQL utilisent toujours la valeur brute (`value`), pas le libellé.
export const facetSlug = (v) => (v || "").trim().toLowerCase().replace(/\s+/g, "_");

// Libellé traduit d'une facette, repli = valeur brute humanisée si clé absente.
export const bodyPartLabel = (t, v) => t(`data.exbody.${facetSlug(v)}`, { defaultValue: v || "" });
export const equipmentLabel = (t, v) => t(`data.exequip.${facetSlug(v)}`, { defaultValue: v || "" });
export const targetLabel = (t, v) => t(`data.extarget.${facetSlug(v)}`, { defaultValue: v || "" });

/* Étapes d'instruction dans la langue demandée, avec repli FR (le dataset ne
   fournit que fr/en ; NL → repli FR). Renvoie un tableau de chaînes. */
export function instructionSteps(row, lang) {
  const steps = row?.instruction_steps || {};
  const arr = steps[lang] || steps.fr || steps.en || [];
  return Array.isArray(arr) ? arr : [];
}

function dbToExercise(r) {
  return {
    id: r.id, ref: r.ref, name: r.name, category: r.category,
    bodyPart: r.body_part, equipment: r.equipment, target: r.target_muscle,
    muscleGroup: r.muscle_group || null,
    secondaryMuscles: Array.isArray(r.secondary_muscles) ? r.secondary_muscles : [],
    instructions: r.instructions || {}, instructionSteps: r.instruction_steps || {},
    gifUrl: r.gif_url || null, thumbUrl: r.thumb_url || null,
    attribution: r.attribution || "", isCustom: !!r.is_custom, teamId: r.team_id || null,
  };
}

/* Liste paginée + filtrée côté serveur. Renvoie la page courante, le total (pour
   la pagination) et l'état de chargement. Réinitialise `page` en amont quand un
   filtre change (fait par l'écran). */
export function useExerciseLibrary({ search = "", bodyPart = "", equipment = "", target = "", page = 0 } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("exercise_library")
      .select("*", { count: "exact" })
      .order("name", { ascending: true });
    const s = search.trim();
    if (s) q = q.ilike("name", `%${s}%`);
    if (bodyPart) q = q.eq("body_part", bodyPart);
    if (equipment) q = q.eq("equipment", equipment);
    if (target) q = q.eq("target_muscle", target);
    q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, error, count } = await q;
    if (error) { console.error("[exercise_library]", error.message); setLoading(false); return; }
    setRows((data ?? []).map(dbToExercise));
    setTotal(count ?? 0);
    setLoading(false);
  }, [search, bodyPart, equipment, target, page]);

  useEffect(() => { fetch(); }, [fetch]);

  return { exercises: rows, total, loading, pageCount: Math.max(1, Math.ceil((total || 0) / PAGE_SIZE)), refresh: fetch };
}

/* Charge des exercices par leurs `ref` (lien depuis un protocole) → map
   { ref: exercice }. Sert à enrichir le rendu (attribution / média) et à ouvrir
   la fiche. Renvoie {} si aucune ref. */
export async function getExercisesByRefs(refs) {
  const list = [...new Set((refs || []).filter(Boolean))];
  if (!list.length) return {};
  const { data, error } = await supabase.from("exercise_library").select("*").in("ref", list);
  if (error) { console.error("[exercise_library byRefs]", error.message); return {}; }
  const out = {};
  (data ?? []).forEach((r) => { const ex = dbToExercise(r); out[ex.ref] = ex; });
  return out;
}

/* Fiche bibliothèque par NOM (les exos de séance ne portent pas de `ref`) :
   correspondance exacte insensible à la casse, repli partiel. Renvoie null si
   aucun exercice ne correspond. */
export async function getExerciseByName(name) {
  const n = (name || "").trim();
  if (!n) return null;
  const { data } = await supabase.from("exercise_library").select("*").ilike("name", n).limit(1);
  if (data && data.length) return dbToExercise(data[0]);
  const { data: d2 } = await supabase.from("exercise_library").select("*").ilike("name", `%${n}%`).limit(1);
  return d2 && d2.length ? dbToExercise(d2[0]) : null;
}

/* ─── Autocomplétion + auto-alimentation (RPC SECURITY DEFINER, migration 0085) ───
   Le nom saisi librement dans un protocole/programme s'auto-complète sur le
   catalogue (~1300 + calisthénie) + les exos perso du club, et se crée en exo
   perso (anti-doublon) si aucune correspondance. Le compteur d'usage fait
   remonter les plus utilisés. */

// Recherche floue classée par usage → [{ id, name, nameEn, category, equipment,
// targetMuscle, thumbUrl, gifUrl, isCustom, isCalisthenics, usageCount }].
export async function searchExercises(q, limit = 12) {
  const query = (q || "").trim();
  if (query.length < 2) return [];
  const { data, error } = await supabase.rpc("search_exercises", { p_q: query, p_limit: limit });
  if (error) { console.error("[search_exercises]", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id, name: r.name, nameEn: r.name_en, category: r.category, equipment: r.equipment,
    targetMuscle: r.target_muscle, thumbUrl: r.thumb_url, gifUrl: r.gif_url,
    isCustom: r.is_custom, isCalisthenics: r.is_calisthenics, usageCount: r.usage_count, sim: r.sim,
  }));
}

// Crée (ou retrouve, anti-doublon) un exercice perso du club → renvoie son id.
export async function createCustomExercise(name, { category = null, equipment = null } = {}) {
  const { data, error } = await supabase.rpc("create_custom_exercise", {
    p_name: name, p_category: category, p_equipment: equipment,
  });
  if (error) throw error;
  return data; // uuid
}

// Incrémente le compteur d'usage des exercices liés (à l'enregistrement).
export async function incrementExerciseUsage(ids) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return;
  const { error } = await supabase.rpc("increment_exercise_usage", { p_ids: list });
  if (error) console.error("[increment_exercise_usage]", error.message);
}

/* Valeurs distinctes des facettes (partie du corps / équipement / muscle ciblé)
   pour peupler les filtres. Lues une fois au montage. */
export function useExerciseFacets() {
  const [facets, setFacets] = useState({ bodyParts: [], equipment: [], targets: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("body_part, equipment, target_muscle");
      if (error) { console.error("[exercise_library facets]", error.message); return; }
      if (!alive) return;
      const uniq = (key) => [...new Set((data ?? []).map((r) => r[key]).filter(Boolean))].sort();
      setFacets({
        bodyParts: uniq("body_part"),
        equipment: uniq("equipment"),
        targets: uniq("target_muscle"),
      });
    })();
    return () => { alive = false; };
  }, []);

  return facets;
}
