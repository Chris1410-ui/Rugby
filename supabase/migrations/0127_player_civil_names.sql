-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0127 — Noms civils des joueurs (table SÉPARÉE, strictement staff/owner).    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Cadrage (pseudonymisation) : les noms civils vivent À PART, ne sont JAMAIS
-- exposés aux joueurs, ni au classement / mur d'équipe / duels. Ils sont lus
-- uniquement par le STAFF/OWNER du club et affichés UNIQUEMENT sur l'écran
-- « Wellness » staff. Partout ailleurs, la règle reste totem + initiales.
--
-- Écriture par RPC SECURITY DEFINER (import par totem + effacement owner), avec
-- self-check d'autorisation. RLS stricte en lecture (staff du club seulement).

create table if not exists public.player_civil_names (
  player_id  uuid primary key references public.players(id) on delete cascade,
  team_id    text not null references public.teams(id) on delete cascade,
  civil_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_player_civil_names_team on public.player_civil_names(team_id);

alter table public.player_civil_names enable row level security;

-- Lecture : STAFF du club (coach inclus) + owner. JAMAIS les joueurs.
drop policy if exists pcn_select on public.player_civil_names;
create policy pcn_select on public.player_civil_names for select to authenticated
using ((public.is_staff() and team_id = public.my_team()) or public.is_owner());

-- Écriture directe : staff écrivain (prépa/médical) + owner (coach exclu).
-- (Les parcours normaux passent par les RPC ci-dessous ; ces policies couvrent
--  un accès direct éventuel et restent strictes.)
drop policy if exists pcn_insert on public.player_civil_names;
create policy pcn_insert on public.player_civil_names for insert to authenticated
with check (((public.is_staff() and public.can_write()) and team_id = public.my_team()) or public.is_owner());

drop policy if exists pcn_update on public.player_civil_names;
create policy pcn_update on public.player_civil_names for update to authenticated
using (((public.is_staff() and public.can_write()) and team_id = public.my_team()) or public.is_owner())
with check (((public.is_staff() and public.can_write()) and team_id = public.my_team()) or public.is_owner());

drop policy if exists pcn_delete on public.player_civil_names;
create policy pcn_delete on public.player_civil_names for delete to authenticated
using (((public.is_staff() and public.can_write()) and team_id = public.my_team()) or public.is_owner());

-- ── Import : rapproche chaque ligne par TOTEM (players.name) dans le club de
--    l'appelant. Renvoie { matched: [...], unmatched: [...] } (totems). ──
create or replace function public.import_civil_names(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text := public.my_team();
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
revoke all on function public.import_civil_names(jsonb) from public, anon;
grant execute on function public.import_civil_names(jsonb) to authenticated;

-- ── Droit à l'effacement : l'OWNER supprime TOUS les noms civils de son club. ──
create or replace function public.clear_civil_names()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text := public.my_team();
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
revoke all on function public.clear_civil_names() from public, anon;
grant execute on function public.clear_civil_names() to authenticated;
