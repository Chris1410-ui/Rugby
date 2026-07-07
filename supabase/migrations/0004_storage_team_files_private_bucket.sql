-- ============================================================================
--  0004 — Étape 8 : stockage privé aligné sur l'équipe.
--  Bucket privé `team-files` (aucune URL publique). Chemins :
--    <team_id>/programs/<program_id>/<fichier>   (PDF de programmes)
--    <team_id>/videos/<clé>/<fichier>            (vidéos d'analyse)
--  1er segment de dossier = team_id → utilisé par les politiques RLS.
--  Lecture : membres de l'équipe · écriture : staff. Accès via URLs signées.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('team-files', 'team-files', false)
on conflict (id) do nothing;

drop policy if exists team_files_read on storage.objects;
drop policy if exists team_files_staff_insert on storage.objects;
drop policy if exists team_files_staff_update on storage.objects;
drop policy if exists team_files_staff_delete on storage.objects;

create policy team_files_read on storage.objects for select to authenticated
  using (bucket_id = 'team-files' and (storage.foldername(name))[1] = public.my_team());

create policy team_files_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'team-files' and (storage.foldername(name))[1] = public.my_team() and public.is_staff());

create policy team_files_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'team-files' and (storage.foldername(name))[1] = public.my_team() and public.is_staff())
  with check (bucket_id = 'team-files' and (storage.foldername(name))[1] = public.my_team() and public.is_staff());

create policy team_files_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'team-files' and (storage.foldername(name))[1] = public.my_team() and public.is_staff());
