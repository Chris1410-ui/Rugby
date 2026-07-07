-- ============================================================================
--  0002 — Seed des équipes + création automatique du profil (et joueur) à
--         l'inscription. Remplace le flux `pwd:*` du prototype par Supabase Auth.
-- ============================================================================

insert into teams (id, sport, label, competition) values
  ('r_u18', 'rugby', 'Belgique U18', 'Championnat Régions U18'),
  ('f_u19', 'foot',  'Diables Rouges U19', 'Élite Jeunes U19'),
  ('f_pro', 'foot',  'Académie Pro', 'Réserve Pro League')
on conflict (id) do nothing;

-- Les infos métier arrivent via raw_user_meta_data (options.data au signUp) :
--   role, team_id, full_name, [player_id | new_player + pos, grp, num]
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role       text := new.raw_user_meta_data->>'role';
  v_team       text := new.raw_user_meta_data->>'team_id';
  v_name       text := new.raw_user_meta_data->>'full_name';
  v_player_id  uuid := nullif(new.raw_user_meta_data->>'player_id','')::uuid;
  v_new_player boolean := coalesce((new.raw_user_meta_data->>'new_player')::boolean, false);
  v_pos        text := new.raw_user_meta_data->>'pos';
  v_grp        text := nullif(new.raw_user_meta_data->>'grp','');
  v_num        int  := nullif(new.raw_user_meta_data->>'num','')::int;
begin
  if v_role is null then
    return new;  -- profil géré ailleurs
  end if;

  if v_role = 'joueur' and v_new_player and v_team is not null then
    insert into public.players (team_id, owner_uid, name, pos, grp, num, is_custom)
    values (v_team, new.id, coalesce(nullif(v_name,''),'Joueur'), v_pos,
            v_grp::player_group, v_num, true)
    returning id into v_player_id;
  end if;

  insert into public.profiles (id, role, full_name, team_id, player_id)
  values (new.id, v_role::app_role, v_name, v_team, v_player_id)
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        team_id = excluded.team_id,
        player_id = coalesce(excluded.player_id, public.profiles.player_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fonction de trigger : jamais appelable via l'API REST (/rpc).
revoke execute on function public.handle_new_user() from anon, authenticated, public;
