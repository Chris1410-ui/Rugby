-- ════════════════════════════════════════════════════════════════
-- 0048 — Section Méditation / Relaxation (gamification, option A).
--
-- Une séance de relaxation faite AUJOURD'HUI rapporte +10 pts, aligné sur
-- l'« activité du jour ». Elle est stockée comme une ligne daily_checkins dédiée
-- (moment = 'meditation') portant l'activité 'meditation' → comptée UNE fois via
-- computePoints (dédup par la clé unique player_id,date,moment), et exclue
-- partout du décompte « bilan » (aucun double +10, aucun impact readiness).
--
-- Le seul obstacle serveur était la contrainte CHECK sur `moment`
-- (matin/soir) : on l'étend à 'meditation'. Aucun barème modifié, aucune
-- nouvelle table, aucune RLS touchée (la policy daily_self couvre déjà l'écriture
-- du joueur sur ses propres lignes ; team_checkin_events renvoie déjà toutes les
-- lignes de l'équipe, activité comprise).
-- ════════════════════════════════════════════════════════════════

alter table public.daily_checkins drop constraint if exists daily_checkins_moment_check;
alter table public.daily_checkins add constraint daily_checkins_moment_check
  check (moment = any (array['matin'::text, 'soir'::text, 'meditation'::text]));
