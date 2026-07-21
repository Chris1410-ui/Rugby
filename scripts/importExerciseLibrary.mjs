/* Import de la Bibliothèque d'exercices dans Supabase (table `exercise_library`).
 *
 * Données MIT uniquement (dataset hasaneyldrm/exercises-dataset) : noms,
 * catégories, muscles, équipement, instructions FR + EN. AUCUN média n'est
 * importé — les GIF/vignettes sont © Gym visual et non redistribuables (le
 * clone du repo ne donne aucun droit) ; thumb_url/gif_url restent null et
 * l'attribution est conservée dans chaque ligne.
 *
 * Idempotent (upsert par `ref`). Nécessite la clé SERVICE ROLE (jamais dans le
 * navigateur / le repo) :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importExerciseLibrary.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis (clé service role).");
  process.exit(1);
}

const data = JSON.parse(readFileSync(new URL("./exercise-library.data.json", import.meta.url), "utf8"));
const rows = data.map((e) => ({
  ref: e.ref,
  name: e.name,
  category: e.category,
  body_part: e.body_part,
  equipment: e.equipment,
  target_muscle: e.target_muscle,
  muscle_group: e.muscle_group ?? null,
  secondary_muscles: e.secondary_muscles ?? [],
  instructions: e.instructions ?? {},
  instruction_steps: e.instruction_steps ?? {},
  media_id: e.media_id ?? null,
  attribution: e.attribution ?? "© Gym visual — https://gymvisual.com/",
  is_custom: false,
  team_id: null,
}));

const supabase = createClient(url, key, { auth: { persistSession: false } });
let done = 0;
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200);
  const { error } = await supabase.from("exercise_library").upsert(chunk, { onConflict: "ref" });
  if (error) { console.error("Échec du lot", i, ":", error.message); process.exit(1); }
  done += chunk.length;
  console.log(`${done}/${rows.length}`);
}
console.log("Import terminé :", done, "exercices.");
