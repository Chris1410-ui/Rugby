-- ============================================================================
--  0052 — `player-files` : autorise aussi le STAFF écrivain du club et l'OWNER
--  à DÉPOSER un PDF de programme pour un joueur (pas seulement le joueur).
--
--  Avant (0051) : insert = le joueur uniquement (son dossier).
--  Après        : insert = joueur (son dossier) ∪ staff écrivain du club
--                 (prépa/médical, can_write) ∪ owner — même forme que la
--                 suppression. Le coach reste lecture seule (exclu de can_write).
--  Lecture et suppression : inchangées (0051).
-- ============================================================================

drop policy if exists player_files_insert on storage.objects;

create policy player_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-files' and (
    (     (storage.foldername(name))[1] = public.my_team()
      and ( (storage.foldername(name))[2] = public.my_player_id()::text
            or public.can_write() ) )
    or public.is_owner()
  )
);
