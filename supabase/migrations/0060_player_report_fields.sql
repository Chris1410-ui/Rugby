-- ============================================================================
--  0060 — Champs de profil pour le RAPPORT DE PERFORMANCE.
--
--  Le rapport PDF a besoin de 3 attributs durables du joueur qui n'étaient pas
--  stockés de façon structurée (seul players.pp_notes, texte libre, existait) :
--    • height_cm         : taille (cm) — mensurations de la couverture / fiche.
--    • sessions_per_week  : nb de séances de renforcement par semaine.
--    • injury_history     : historique blessures & gênes (texte, saisi par le staff).
--  Éditables par le staff écrivain sur la Fiche (RLS players existante : seul le
--  staff écrivain / owner écrit ; le joueur ne modifie pas ces champs).
-- ============================================================================

alter table public.players add column if not exists height_cm        int;
alter table public.players add column if not exists sessions_per_week int;
alter table public.players add column if not exists injury_history    text;
