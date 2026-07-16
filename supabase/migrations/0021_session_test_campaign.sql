-- ════════════════════════════════════════════════════════════════
-- 0021 — Séance de type « test » liée à une campagne de tests.
--
-- Une séance-test (code 'TEST') planifie une session de tests physiques,
-- assignée aux joueurs du camp à une date. Le jour dit, la saisie se fait
-- depuis cette séance et écrit dans LA campagne de tests du camp
-- (test_campaigns rattachée au camp) → report fiche + Top 14 + points déjà
-- branchés. `campaign_id` matérialise ce lien (nullable : rempli à la 1re
-- saisie). Aucune table parallèle, aucun changement de RLS (les policies
-- sessions staff/owner + lecture équipe couvrent déjà la colonne).
-- ════════════════════════════════════════════════════════════════

alter table sessions add column campaign_id uuid references test_campaigns(id) on delete set null;
create index on sessions(campaign_id);
