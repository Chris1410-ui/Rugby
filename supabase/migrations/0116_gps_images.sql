-- ─────────────────────────────────────────────────────────────────────────────
-- GPS-5a — Type + onglet d'origine des captures GPS (heatmaps conservées).
--
-- Une capture n'est pas qu'un chemin : on garde son TYPE (heatmap/stats/chart) et,
-- pour les heatmaps, l'ONGLET d'origine (speed/distance/intensity/other). Colonne
-- jsonb `images` = [{ path, kind, tab }] ; `image_paths` (text[]) reste la source
-- de vérité pour le stockage (upload/suppression, rétro-compat). Les anciens dépôts
-- gardent images=[] → l'UI retombe sur image_paths (kind inconnu).
--
-- Aucune RLS supplémentaire : hérite des policies gps_sessions (cloisonnement club).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.gps_sessions
  add column if not exists images jsonb not null default '[]'::jsonb;
