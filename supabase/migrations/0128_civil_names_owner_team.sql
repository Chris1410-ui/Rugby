-- 0128 — Noms civils : accepter le club sélectionné (p_team_id) pour l'OWNER.
-- L'owner a souvent profiles.team_id = NULL → my_team() est null → NO_TEAM.
-- L'écran connaît le club affiché : on le passe en paramètre et on l'utilise
-- quand l'appelant est owner. Le staff « normal » garde my_team() (p_team_id
-- ignoré) pour éviter tout écriture cross-club.

drop function if exists public.import_civil_names(jsonb);
create or replace function public.import_civil_names(p_rows jsonb, p_team_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Owner : club choisi (ou son my_team en repli). Staff : toujours my_team().
  v_team text := case when public.is_owner() then coalesce(p_team_id, public.my_team()) else public.my_team() end;
  r jsonb;
  v_totem text;
  v_name  text;
  v_pid   uuid;
  v_matched   text[] := '{}';
  v_unmatched text[] := '{}';
begin
  if not (public.is_owner() or (public.is_staff() and public.can_write())) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_team is null then
    raise exception 'NO_TEAM';
  end if;

  for r in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as t(value) loop
    v_totem := trim(coalesce(r->>'totem', ''));
    v_name  := trim(coalesce(r->>'name', ''));
    if v_totem = '' or v_name = '' then
      continue;
    end if;
    select id into v_pid
      from public.players
     where team_id = v_team and lower(name) = lower(v_totem)
     limit 1;
    if v_pid is null then
      v_unmatched := array_append(v_unmatched, v_totem);
    else
      insert into public.player_civil_names (player_id, team_id, civil_name, updated_at, updated_by)
        values (v_pid, v_team, v_name, now(), auth.uid())
      on conflict (player_id) do update
        set civil_name = excluded.civil_name, updated_at = now(), updated_by = auth.uid();
      v_matched := array_append(v_matched, v_totem);
    end if;
  end loop;

  return jsonb_build_object('matched', to_jsonb(v_matched), 'unmatched', to_jsonb(v_unmatched));
end;
$$;
revoke all on function public.import_civil_names(jsonb, text) from public, anon;
grant execute on function public.import_civil_names(jsonb, text) to authenticated;

drop function if exists public.clear_civil_names();
create or replace function public.clear_civil_names(p_team_id text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text := coalesce(p_team_id, public.my_team());
  v_count integer;
begin
  if not public.is_owner() then
    raise exception 'OWNER_ONLY';
  end if;
  if v_team is null then
    raise exception 'NO_TEAM';
  end if;
  delete from public.player_civil_names where team_id = v_team;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.clear_civil_names(text) from public, anon;
grant execute on function public.clear_civil_names(text) to authenticated;
