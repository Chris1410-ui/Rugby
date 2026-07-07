import { supabase } from "../lib/supabase.js";

/* Stockage privé (bucket `team-files`). Aucune URL publique : tout accès en
   lecture passe par une URL SIGNÉE à durée limitée. Les chemins commencent par
   le team_id (1er segment) → les politiques RLS filtrent par équipe. */

export const BUCKET = "team-files";
const bucket = () => supabase.storage.from(BUCKET);

// Nettoie un nom de fichier (évite les segments de chemin / caractères gênants)
export function sanitize(name) {
  return (name || "fichier")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

export const programFolder = (teamId, programId) => `${teamId}/programs/${programId}`;
export const videoFolder = (teamId, key) => `${teamId}/videos/${key}`;

// Upload (staff). Un préfixe temporel évite les collisions de noms.
export async function uploadFile(folder, file) {
  const stamp = String(Date.now()).slice(-8);
  const path = `${folder}/${stamp}_${sanitize(file.name)}`;
  const { error } = await bucket().upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

// Liste les fichiers d'un dossier
export async function listFolder(folder) {
  const { data, error } = await bucket().list(folder, { sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return (data ?? [])
    .filter((o) => o.id) // ignore les sous-dossiers
    .map((o) => ({ name: o.name, path: `${folder}/${o.name}`, size: o.metadata?.size, created: o.created_at }));
}

// URL signée (lecture) — expire après `expiresIn` secondes (défaut 1h)
export async function signedUrl(path, expiresIn = 3600) {
  const { data, error } = await bucket().createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFile(path) {
  const { error } = await bucket().remove([path]);
  if (error) throw error;
}
