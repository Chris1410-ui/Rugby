-- ════════════════════════════════════════════════════════════════
-- 0015 — Fiche joueur : champs de tests S&C supplémentaires.
--
-- Saisis par le préparateur / staff, lus par le joueur (lecture seule) —
-- mêmes policies RLS que les autres colonnes de `players` (écriture staff de
-- l'équipe, lecture par le joueur concerné + l'équipe). Valeur courante (pas
-- d'historisation à ce stade), comme les tests existants.
--
-- Bronco (players.bronco) et Yo-Yo (players.yoyo) existent déjà (0011) →
-- réutilisés, pas de doublon. On n'ajoute que les champs manquants.
--   • squat_5rm      : texte — accepte une notation type « 3x170 » ou « 170 ».
--   • cmj_overall    : CMJ / Overall Jump (cm, décimales).
--   • bench_5rm      : Bench 5RM (kg, décimales).
--   • hang_clean_2rm : Hang Clean 2RM (kg).
--   • pp_notes       : remarques du préparateur (objectifs / consignes).
-- ════════════════════════════════════════════════════════════════

alter table players add column if not exists squat_5rm      text;
alter table players add column if not exists cmj_overall     numeric;
alter table players add column if not exists bench_5rm       numeric;
alter table players add column if not exists hang_clean_2rm  numeric;
alter table players add column if not exists pp_notes        text;
