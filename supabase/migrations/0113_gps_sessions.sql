-- 0113 — Données GPS par capture (GPS-1 : fondations). Le joueur remonte des
-- métriques GPS de match/entraînement (extraites d'une capture par IA vision,
-- ou saisies à la main). Charge EXTERNE objective, complémentaire du sRPE —
-- AUCUNE formule existante (playerLoad/ACWR/points) n'est modifiée ici.

create table if not exists public.gps_sessions (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  team_id       text not null references public.teams(id)   on delete cascade,
  club_id       uuid,                        -- dénormalisé (isolement + agrégats)
  date          date not null,
  session_name  text,                        -- ⚠ peut contenir un nom réel : jamais en UI collective
  provider      text,                        -- pitchero | catapult | statsports | other | null
  linked_session_id  uuid references public.sessions(id)  on delete set null,
  linked_training_id uuid references public.trainings(id) on delete set null,
  source        text not null default 'ai',  -- 'ai' | 'manual'
  -- Métriques : TOUTES nullables (vide si non lu, jamais inventé).
  distance_m    numeric,
  m_per_min     numeric,
  hsr_m         numeric,                      -- distance haute intensité (High Speed Running)
  hsr_count     integer,
  vmax_kmh      numeric,
  vavg_kmh      numeric,
  duration_sec  integer,
  speed_zones   jsonb not null default '[]',  -- [{zone:'walk|jog|run|sprint', sec, pct}]
  image_paths   text[] not null default '{}', -- objets du bucket gps-shots
  confidence    jsonb not null default '{}',  -- { distance_m:0.9, vmax_kmh:0.7, … } par champ
  name_detected boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid()
);
create index if not exists gps_sessions_team_date_idx   on public.gps_sessions(team_id, date);
create index if not exists gps_sessions_player_date_idx on public.gps_sessions(player_id, date);

-- club_id dérivé du team (cohérence isolement / futurs agrégats club).
create or replace function public._gps_set_club() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.club_id is null then
    select t.club_id into new.club_id from public.teams t where t.id = new.team_id;
  end if;
  return new;
end $$;
drop trigger if exists gps_set_club on public.gps_sessions;
create trigger gps_set_club before insert on public.gps_sessions
  for each row execute function public._gps_set_club();

-- ── RLS : le joueur gère les SIENNES ; le staff du même club lit (prépa/médical/
--    coach) ; owner tout accès. Isolement club strict via team_id. ────────────
alter table public.gps_sessions enable row level security;

create policy gps_sel on public.gps_sessions for select to authenticated using (
  is_owner()
  or player_id = my_player_id()
  or (is_staff() and team_id = my_team())
);
create policy gps_ins on public.gps_sessions for insert to authenticated with check (
  player_id = my_player_id() and team_id = my_team()
);
create policy gps_upd on public.gps_sessions for update to authenticated
  using (is_owner() or player_id = my_player_id() or (can_write() and team_id = my_team()))
  with check (is_owner() or player_id = my_player_id() or (can_write() and team_id = my_team()));
create policy gps_del on public.gps_sessions for delete to authenticated using (
  is_owner() or player_id = my_player_id() or (can_write() and team_id = my_team())
);

-- ── Bucket privé des captures GPS (images), dossier <team_id>/<player_id>/… ───
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('gps-shots', 'gps-shots', false, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gps_shots_read   on storage.objects;
drop policy if exists gps_shots_insert on storage.objects;
drop policy if exists gps_shots_delete on storage.objects;

create policy gps_shots_read on storage.objects for select to authenticated using (
  bucket_id = 'gps-shots' and (
    ( (storage.foldername(name))[1] = my_team()
      and ( (storage.foldername(name))[2] = my_player_id()::text or is_staff() ) )
    or is_owner()
  )
);
create policy gps_shots_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'gps-shots'
  and (storage.foldername(name))[1] = my_team()
  and (storage.foldername(name))[2] = my_player_id()::text
);
create policy gps_shots_delete on storage.objects for delete to authenticated using (
  bucket_id = 'gps-shots' and (
    ( (storage.foldername(name))[1] = my_team()
      and ( (storage.foldername(name))[2] = my_player_id()::text or can_write() ) )
    or is_owner()
  )
);

-- ── Agrégats k-anonymes (≥5 joueurs) : moyennes de MA ligne / MON équipe sur une
--    fenêtre. Aucune valeur brute d'autrui exposée ; le seuil est SERVEUR (having).
create or replace function public.gps_line_stats(p_days int default 90)
  returns table(metric text, avg_val numeric, n int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, grp, team_id from players where id = my_player_id()),
  pp as (
    select g.player_id,
           avg(g.distance_m) as distance_m, avg(g.hsr_m) as hsr_m,
           max(g.vmax_kmh)  as vmax_kmh,   avg(g.m_per_min) as m_per_min
    from gps_sessions g join players p on p.id = g.player_id
    where p.team_id = (select team_id from me) and p.grp = (select grp from me)
      and g.date >= current_date - make_interval(days => greatest(1, p_days))
    group by g.player_id
  ),
  unp as (
    select 'distance_m' m, distance_m v from pp where distance_m is not null
    union all select 'hsr_m',     hsr_m     from pp where hsr_m is not null
    union all select 'vmax_kmh',  vmax_kmh  from pp where vmax_kmh is not null
    union all select 'm_per_min', m_per_min from pp where m_per_min is not null
  )
  select m, round(avg(v)::numeric, 2), count(*)::int
  from unp group by m having count(*) >= 5
$$;

create or replace function public.gps_team_stats(p_days int default 90)
  returns table(metric text, avg_val numeric, n int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select team_id from players where id = my_player_id()),
  pp as (
    select g.player_id,
           avg(g.distance_m) as distance_m, avg(g.hsr_m) as hsr_m,
           max(g.vmax_kmh)  as vmax_kmh,   avg(g.m_per_min) as m_per_min
    from gps_sessions g join players p on p.id = g.player_id
    where p.team_id = (select team_id from me)
      and g.date >= current_date - make_interval(days => greatest(1, p_days))
    group by g.player_id
  ),
  unp as (
    select 'distance_m' m, distance_m v from pp where distance_m is not null
    union all select 'hsr_m',     hsr_m     from pp where hsr_m is not null
    union all select 'vmax_kmh',  vmax_kmh  from pp where vmax_kmh is not null
    union all select 'm_per_min', m_per_min from pp where m_per_min is not null
  )
  select m, round(avg(v)::numeric, 2), count(*)::int
  from unp group by m having count(*) >= 5
$$;

revoke all on function public.gps_line_stats(int) from anon, public;
revoke all on function public.gps_team_stats(int) from anon, public;
grant execute on function public.gps_line_stats(int) to authenticated;
grant execute on function public.gps_team_stats(int) to authenticated;
