-- ============================================================================
--  0051 — PDF de programme uploadés par le JOUEUR (bucket privé `player-files`).
--
--  Chemins : <team_id>/<player_id>/<timestamp>_<fichier>.pdf
--    · segment 1 = team_id   → isolation par club
--    · segment 2 = player_id → propriété (le joueur ne gère que son dossier)
--
--  PDF UNIQUEMENT (allowed_mime_types) · AUCUNE limite de taille (file_size_limit
--  null) · bucket privé (aucune URL publique → accès par URL signée).
--
--  Lecture     : le joueur (ses fichiers) · le staff du même club · l'owner.
--  Ajout       : le joueur UNIQUEMENT, dans son propre dossier.
--  Suppression : le joueur · le staff écrivain du club (prépa/médical) · l'owner.
--                (le coach est lecture seule → exclu de la suppression via
--                 can_write(), cohérent avec le modèle de rôles de l'app.)
--
--  Réutilise les helpers RLS existants : my_team(), my_player_id(), is_staff(),
--  can_write() (0032), is_owner() (0009). Aucun accès inter-clubs.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-files', 'player-files', false, null, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists player_files_read   on storage.objects;
drop policy if exists player_files_insert on storage.objects;
drop policy if exists player_files_delete on storage.objects;

-- Lecture : propriétaire (joueur) OU staff du même club OU owner.
create policy player_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'player-files' and (
    (     (storage.foldername(name))[1] = public.my_team()
      and ( (storage.foldername(name))[2] = public.my_player_id()::text
            or public.is_staff() ) )
    or public.is_owner()
  )
);

-- Ajout : le joueur uniquement, dans SON dossier <team_id>/<player_id>/…
create policy player_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-files'
  and (storage.foldername(name))[1] = public.my_team()
  and (storage.foldername(name))[2] = public.my_player_id()::text
);

-- Suppression : le joueur (ses fichiers) OU le staff écrivain du club OU l'owner.
create policy player_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'player-files' and (
    (     (storage.foldername(name))[1] = public.my_team()
      and ( (storage.foldername(name))[2] = public.my_player_id()::text
            or public.can_write() ) )
    or public.is_owner()
  )
);
