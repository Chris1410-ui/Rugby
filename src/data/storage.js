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
// Bibliothèque vidéo d'analyse de l'équipe (dossier plat)
export const teamVideosFolder = (teamId) => `${teamId}/videos`;

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

/* ── PDF de programme du JOUEUR (bucket privé `player-files`) ──
   Chemin <team_id>/<player_id>/<timestamp>_<fichier>.pdf → 1er segment = team_id
   (isolation club), 2e = player_id (propriété). PDF uniquement (doublé par
   `allowed_mime_types` côté bucket) ; lecture par URL signée. Cf. migration 0051. */
export const PLAYER_BUCKET = "player-files";
const playerBucket = () => supabase.storage.from(PLAYER_BUCKET);
export const playerFilesFolder = (teamId, playerId) => `${teamId}/${playerId}`;

// Upload joueur — gardes AVANT tout accès réseau : cible valide + PDF-only.
export async function uploadPlayerPdf(teamId, playerId, file) {
  if (!teamId || !playerId) throw new Error("NO_TARGET"); // dossier <team>/<player> incomplet
  if (!file || file.type !== "application/pdf") throw new Error("PDF_ONLY");
  const stamp = String(Date.now()).slice(-8);
  const path = `${playerFilesFolder(teamId, playerId)}/${stamp}_${sanitize(file.name)}`;
  const { error } = await playerBucket().upload(path, file, { upsert: false, contentType: "application/pdf" });
  if (error) throw error;
  return path;
}

export async function listPlayerFiles(teamId, playerId) {
  const folder = playerFilesFolder(teamId, playerId);
  const { data, error } = await playerBucket().list(folder, { sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return (data ?? [])
    .filter((o) => o.id)
    .map((o) => ({ name: o.name, path: `${folder}/${o.name}`, size: o.metadata?.size, created: o.created_at }));
}

// URL signée (1 h). `download:true` force le téléchargement plutôt que l'ouverture.
export async function playerFileUrl(path, { download = false } = {}) {
  const { data, error } = await playerBucket().createSignedUrl(path, 3600, download ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function removePlayerFile(path) {
  const { error } = await playerBucket().remove([path]);
  if (error) throw error;
}
