-- Notifie tous les joueurs (réels) du club quand une vidéo est ajoutée à la
-- médiathèque. Réutilise le pipeline notifications (in-app + push via notify_push).
create or replace function public.notify_media()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, p.id, 'media', '🎬 Nouvelle vidéo',
           coalesce(nullif(btrim(new.titre), ''), new.theme, 'Médiathèque'),
           new.id, 'media'
    from public.players p
    where p.team_id = new.team_id and coalesce(p.is_demo, false) = false;
  return new;
end $function$;

drop trigger if exists notify_media_trg on public.media;
create trigger notify_media_trg
  after insert on public.media
  for each row execute function public.notify_media();
