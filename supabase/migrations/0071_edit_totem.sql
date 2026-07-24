-- 0071 — Modification du totem depuis la fiche joueur.
--
-- Deux RPC SECURITY DEFINER (un seul totem courant, unicité (team_id, totem)
-- insensible casse + espaces, garantie aussi par l'index players_team_name_uq) :
--   • set_my_totem      : le JOUEUR modifie SON totem (sa fiche).
--   • set_player_totem  : le STAFF écrivain modifie le totem d'un joueur de SON
--                          club (can_write() + team_id = my_team()).
-- Collision → exception TOTEM_TAKEN (refus propre ; le client propose une
-- alternative). Aucun accès inter-clubs (le staff est borné à son équipe).

create or replace function public.set_my_totem(p_totem text)
returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  v_pid   uuid := public.my_player_id();
  v_team  text;
  v_totem text := btrim(coalesce(p_totem, ''));
begin
  if v_pid is null then raise exception 'NO_PLAYER'; end if;
  if v_totem = '' then raise exception 'TOTEM_REQUIRED'; end if;
  select team_id into v_team from public.players where id = v_pid;
  if exists (
    select 1 from public.players
    where team_id = v_team and id <> v_pid and lower(btrim(name)) = lower(v_totem)
  ) then
    raise exception 'TOTEM_TAKEN';
  end if;
  update public.players set name = v_totem where id = v_pid;
  return v_totem;
end $$;
revoke all on function public.set_my_totem(text) from public, anon;
grant execute on function public.set_my_totem(text) to authenticated;

create or replace function public.set_player_totem(p_player uuid, p_totem text)
returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  v_team  text;
  v_totem text := btrim(coalesce(p_totem, ''));
begin
  if not public.can_write() then raise exception 'NOT_ALLOWED'; end if;
  if v_totem = '' then raise exception 'TOTEM_REQUIRED'; end if;
  select team_id into v_team from public.players where id = p_player;
  -- Isolation stricte par club : le staff ne touche QUE les joueurs de son équipe.
  if v_team is null or v_team <> public.my_team() then raise exception 'NOT_ALLOWED'; end if;
  if exists (
    select 1 from public.players
    where team_id = v_team and id <> p_player and lower(btrim(name)) = lower(v_totem)
  ) then
    raise exception 'TOTEM_TAKEN';
  end if;
  update public.players set name = v_totem where id = p_player;
  return v_totem;
end $$;
revoke all on function public.set_player_totem(uuid, text) from public, anon;
grant execute on function public.set_player_totem(uuid, text) to authenticated;
