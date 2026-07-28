-- ─────────────────────────────────────────────────────────────────────────────
-- SA-3 — Désactivation (réversible) du profil athlète du staff.
--
-- Désactiver = délier profiles.player_id + passer la carte en membership_status
-- 'inactive' (elle disparaît alors de l'effectif et du classement pour tous). La
-- carte et son historique sont CONSERVÉS : réactiver réutilise la même carte
-- (même totem, mêmes points/données) au lieu d'en créer une nouvelle.
--
-- On ne touche qu'une carte `is_staff_athlete` appartenant à l'appelant
-- (owner_uid = auth.uid) — jamais un vrai joueur.
-- ─────────────────────────────────────────────────────────────────────────────

-- Activation : réutilise une carte athlète existante du compte (réactivation)
-- avant d'en créer une neuve. Idempotente.
create or replace function public.activate_staff_athlete()
  returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_role app_role; v_team text; v_existing uuid; v_pid uuid; v_name text;
begin
  select role, team_id, player_id into v_role, v_team, v_existing from public.profiles where id = v_uid;
  if v_role is null or v_team is null then raise exception 'NOT_STAFF'; end if;
  if v_role not in ('preparateur','medical','coach') then raise exception 'NOT_STAFF'; end if;
  if v_existing is not null then return v_existing; end if; -- déjà rattaché → idempotent
  -- Carte athlète déjà existante (désactivée) du même compte → on la réactive.
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

-- Désactivation : délie le profil + passe la carte athlète en 'inactive'
-- (historique conservé). No-op si l'appelant n'a pas de carte athlète.
create or replace function public.deactivate_staff_athlete()
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_pid uuid;
begin
  select player_id into v_pid from public.profiles where id = v_uid;
  if v_pid is null then return; end if;
  -- Ne délie/masque que si c'est bien une carte athlète du staff appartenant à l'appelant.
  if exists (select 1 from public.players p where p.id = v_pid and p.is_staff_athlete and p.owner_uid = v_uid) then
    update public.players set membership_status = 'inactive' where id = v_pid;
    update public.profiles set player_id = null where id = v_uid;
  end if;
end $$;

revoke execute on function public.deactivate_staff_athlete() from public, anon;
grant execute on function public.deactivate_staff_athlete() to authenticated;
