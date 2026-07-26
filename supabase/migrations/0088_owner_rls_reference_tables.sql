-- 0088 — Fix RLS : l'OWNER (multi-clubs) était bloqué sur les tables de référence
--
-- Bug bloquant : « new row violates row-level security policy for table
-- "reference_docs" ». Les policies écrites en 0086/0083 exigent
-- `is_staff() and club_id = my_club()`. Or pour le compte OWNER :
--   • is_staff() = false  (role = 'owner', pas dans preparateur/medical/coach) ;
--   • my_club()  = NULL   (profil owner sans team_id → my_team() NULL → my_club() NULL).
-- Les deux conditions échouent → toute écriture (et lecture club) est refusée.
--
-- Le reste du schéma donne un BYPASS owner (cf. players_owner/sessions_owner en
-- 0009, section_templates en 0075). Ces tables récentes l'avaient oublié. On
-- ajoute la branche `is_owner()` (l'owner est déjà administrateur global ; le
-- client envoie le club_id du club SÉLECTIONNÉ, préservé par le WITH CHECK).

-- ── reference_docs ───────────────────────────────────────────────────────────
drop policy if exists reference_docs_rw on public.reference_docs;
create policy reference_docs_rw on public.reference_docs for all
  using (is_owner() or (is_staff() and club_id = my_club()))
  with check (is_owner() or (is_staff() and club_id = my_club()));

-- ── reference_doc_sections ───────────────────────────────────────────────────
drop policy if exists reference_doc_sections_rw on public.reference_doc_sections;
create policy reference_doc_sections_rw on public.reference_doc_sections for all
  using (is_owner() or (is_staff() and exists (
    select 1 from public.reference_docs d where d.id = doc_id and d.club_id = my_club())))
  with check (is_owner() or (is_staff() and exists (
    select 1 from public.reference_docs d where d.id = doc_id and d.club_id = my_club())));

-- ── knowledge_notes ──────────────────────────────────────────────────────────
-- Lecture : catalogue global (club_id null) OU note de mon club OU owner.
drop policy if exists knowledge_notes_read on public.knowledge_notes;
create policy knowledge_notes_read on public.knowledge_notes for select using (
  club_id is null or club_id = my_club() or is_owner()
);
-- Écriture : staff de son club OU owner.
drop policy if exists knowledge_notes_write on public.knowledge_notes;
create policy knowledge_notes_write on public.knowledge_notes for all
  using (is_owner() or (is_staff() and club_id = my_club()))
  with check (is_owner() or (is_staff() and club_id = my_club()));
