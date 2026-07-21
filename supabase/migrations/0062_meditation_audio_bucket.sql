-- ============================================================================
--  0062 — Bucket PUBLIC `meditation-audio` (audio d'ambiance des séances).
--
--  L'audio des séances de méditation/relaxation n'est PAS sensible et est
--  identique pour tous les joueurs → bucket public en LECTURE (streamable et
--  caché par le CDN, sans URL signée). Chemin : <id-de-séance>.mp3
--  (ex. jacobson-global.mp3). L'audio est OPTIONNEL : si le fichier est absent,
--  la séance se déroule en texte seul (aucune erreur côté client).
--
--  Écriture réservée à l'owner (Head of Performance) — en pratique upload via le
--  dashboard Supabase. Lecture ouverte à tous (public), y compris anon.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('meditation-audio', 'meditation-audio', true)
on conflict (id) do update set public = true;

drop policy if exists meditation_audio_read        on storage.objects;
drop policy if exists meditation_audio_owner_insert on storage.objects;
drop policy if exists meditation_audio_owner_update on storage.objects;
drop policy if exists meditation_audio_owner_delete on storage.objects;

-- Lecture publique (tout le monde, y compris non authentifié).
create policy meditation_audio_read on storage.objects for select to public
  using (bucket_id = 'meditation-audio');

-- Écriture / mise à jour / suppression : owner uniquement.
create policy meditation_audio_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meditation-audio' and public.is_owner());

create policy meditation_audio_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'meditation-audio' and public.is_owner())
  with check (bucket_id = 'meditation-audio' and public.is_owner());

create policy meditation_audio_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meditation-audio' and public.is_owner());
