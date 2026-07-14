-- ════════════════════════════════════════════════════════════════
-- 0010 — Multi-clubs : ajout du club Namur (rugby).
--
-- L'isolation par club est déjà assurée par les policies existantes
-- (scoping `my_team()`) ; l'owner voit tous les clubs (bypass `is_owner()`).
-- Cette migration ne fait qu'ajouter le second club.
-- ════════════════════════════════════════════════════════════════

insert into teams (id, sport, label, competition)
values ('r_namur', 'rugby', 'Namur', 'Championnat Régions U18')
on conflict (id) do nothing;
