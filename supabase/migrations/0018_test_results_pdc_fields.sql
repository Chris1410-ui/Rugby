-- ════════════════════════════════════════════════════════════════
-- 0018 — Champs pour la comparaison Top 14 (force en ×PdC).
--
-- Complète test_results pour couvrir les 7 tests de la table Top 14 :
--   • bodyweight : poids de corps (kg) → permet le ×PdC (charge / PdC).
--   • deadlift   : Deadlift (kg).
--   • tractions  : Tractions lestées — charge AJOUTÉE (kg) → +×PdC.
-- Squat 5RM / Bench 5RM (déjà présents, en kg) deviennent des ×PdC via le
-- poids de corps. Bronco / Yo-Yo / CMJ restent en valeur brute.
-- Suit les policies RLS existantes de test_results (aucune RLS à changer).
-- ════════════════════════════════════════════════════════════════

alter table test_results add column if not exists bodyweight numeric;
alter table test_results add column if not exists deadlift   numeric;
alter table test_results add column if not exists tractions  numeric;
