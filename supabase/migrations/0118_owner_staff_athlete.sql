-- ─────────────────────────────────────────────────────────────────────────────
-- SA-4 — L'OWNER (Head of Performance) peut aussi avoir un profil athlète.
--
-- Jusqu'ici activate_staff_athlete() était réservée à preparateur/medical/coach
-- (l'owner, multi-clubs, était exclu). On l'ouvre à l'owner en lui laissant
-- CHOISIR le club de rattachement (p_team) — les autres rôles restent rattachés
-- à leur propre équipe (p_team ignoré). Réversibilité inchangée (0117).
--
-- On remplace la version sans argument par une version (p_team text default null)
-- pour rester rétro-compatible : l'appel sans argument (staff) résout le défaut.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.activate_staff_athlete();

create or replace function public.activate_staff_athlete(p_team text default null)
  returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_role app_role; v_pteam text; v_team text; v_existing uuid; v_pid uuid; v_name text;
begin
  select role, team_id, player_id into v_role, v_pteam, v_existing from public.profiles where id = v_uid;
  if v_role is null then raise exception 'NOT_STAFF'; end if;
  if v_role not in ('preparateur','medical','coach','owner') then raise exception 'NOT_STAFF'; end if;
  if v_existing is not null then return v_existing; end if; -- déjà rattaché → idempotent
  -- Équipe cible : owner → club choisi (p_team) ; staff → sa propre équipe.
  if v_role = 'owner' then
    v_team := coalesce(p_team, v_pteam);
  else
    v_team := v_pteam;
  end if;
  if v_team is null then raise exception 'NO_TEAM'; end if;
  -- Réutilise une carte athlète existante du compte pour ce club (réactivation).
  select id into v_pid from public.players
    where owner_uid = v_uid and is_staff_athlete and team_id = v_team limit 1;
  if v_pid is not null then
    update public.players set membership_status = 'active' where id = v_pid;
  else
    v_name := public.unique_totem(v_team, null);
    insert into public.players (team_id, owner_uid, name, is_staff_athlete, membership_status, is_custom)
      values (v_team, v_uid, v_name, true, 'active', false)
      returning id into v_pid;
  end if;
  update public.profiles set player_id = v_pid where id = v_uid;
  return v_pid;
end $$;

revoke execute on function public.activate_staff_athlete(text) from public, anon;
grant execute on function public.activate_staff_athlete(text) to authenticated;
