-- ============================================================================
--  0059 — Suppression des tables ORPHELINES (nettoyage de dérive de schéma).
--
--  fixtures / standings / match_events / match_uploads / player_stats existaient
--  en base mais n'étaient créées par AUCUNE migration du repo (dérive) et
--  n'avaient AUCUNE référence côté client (feature « matchs/stats » scaffoldée
--  puis abandonnée — établi à l'audit). On les supprime pour réaligner le schéma
--  sur la source de vérité (migrations) et retirer la dérive.
--
--  DROP … RESTRICT (défaut, pas de CASCADE) : si une dépendance inattendue
--  existait (FK entrante, vue…), la suppression échoue franchement plutôt que
--  de cascader. Les policies RLS / index / FK sortantes de ces tables tombent
--  automatiquement avec elles.
-- ============================================================================

drop table if exists public.match_events;
drop table if exists public.match_uploads;
drop table if exists public.player_stats;
drop table if exists public.standings;
drop table if exists public.fixtures;
