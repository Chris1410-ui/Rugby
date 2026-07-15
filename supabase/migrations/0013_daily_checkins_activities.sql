-- ════════════════════════════════════════════════════════════════
-- 0013 — Activité du jour déclarée par le joueur (écran Aujourd'hui).
--
-- Le joueur déclare son activité du jour parmi salle / course / natation.
-- Chaque thématique déclarée rapporte +10 points (cf. computePoints).
-- Stockée dans le bilan du jour (une ligne par joueur/date) → tableau de
-- clés d'activité. Aucune RLS à changer : suit les policies de daily_checkins.
-- ════════════════════════════════════════════════════════════════

alter table daily_checkins add column if not exists activities text[] not null default '{}';
