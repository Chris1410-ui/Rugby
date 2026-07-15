-- ════════════════════════════════════════════════════════════════
-- 0011 — Fiche joueur : tests Bronco et Yo-Yo.
--
-- Deux tests de terrain supplémentaires, saisis/affichés comme les tests
-- physiques existants (MAS, Back Squat, CMJ, Ischios).
--   • bronco : temps de réalisation du test Bronco (chaîne « mm:ss »,
--     plus c'est bas mieux c'est).
--   • yoyo   : distance totale au Yo-Yo IR (mètres, numérique).
-- Aucune RLS à changer : ces colonnes suivent les policies de `players`.
-- ════════════════════════════════════════════════════════════════

alter table players add column if not exists bronco text;
alter table players add column if not exists yoyo   numeric;
