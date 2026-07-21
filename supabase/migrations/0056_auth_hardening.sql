-- ============================================================================
--  0056 — Durcissement AUTH (corrige 2 failles critiques d'escalade de rôle).
--
--  L'autorité applicative dérive entièrement de `profiles.role` (is_owner /
--  is_staff / can_write). Deux chemins permettaient de s'octroyer un rôle :
--
--  (1) profiles_self était `FOR ALL` → un compte pouvait
--        update profiles set role='owner', team_id=null where id = auth.uid()
--      (le WITH CHECK id=auth.uid() passait) → auto-promotion owner/staff.
--      Aucun code client n'écrit jamais dans `profiles` (INSERT via trigger,
--      UPDATE via RPC SECURITY DEFINER : set_my_locale / set_my_initials /
--      set_my_onboarding_seen). On restreint donc la policy à SELECT.
--
--  (2) handle_new_user recopiait `raw_user_meta_data->>'role'` (= options.data
--      du signUp, contrôlé par le client) SANS validation → on pouvait
--      s'inscrire directement avec role='owner' (ou staff d'un club arbitraire)
--      via un appel SDK forgé. On whiteliste les rôles auto-inscriptibles par
--      l'UI {joueur, preparateur, medical, coach} ; tout autre rôle — owner en
--      particulier — est rétrogradé en 'joueur'. L'owner (super-admin cross-club)
--      reste provisionné HORS-BANDE (mise à jour de profiles.role par un admin
--      via service role), jamais par auto-inscription.
--
--  NB : l'auto-inscription du STAFF vers un club qu'il choisit reste possible
--  (design produit actuel : l'UI propose préparateur/médical/coach). La verrouiller
--  derrière une invitation/approbation est une évolution recommandée séparée.
-- ============================================================================

-- (1) profiles_self : lecture seule (plus aucun UPDATE/INSERT/DELETE client).
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select
  using ( id = auth.uid() );

-- (2) handle_new_user : whitelist des rôles auto-inscriptibles. Corps identique
--     à 0038, on n'ajoute QUE la rétrogradation des rôles hors périmètre.
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
  v_initials   text := nullif(btrim(new.raw_user_meta_data->>'initials'),'');
  v_player_id  uuid := nullif(new.raw_user_meta_data->>'player_id','')::uuid;
  v_new_player boolean := coalesce((new.raw_user_meta_data->>'new_player')::boolean, false);
  v_pos        text := new.raw_user_meta_data->>'pos';
  v_grp        text := nullif(new.raw_user_meta_data->>'grp','');
  v_num        int  := nullif(new.raw_user_meta_data->>'num','')::int;
  v_g_name     text := nullif(new.raw_user_meta_data->>'guardian_name','');
  v_g_email    text := nullif(new.raw_user_meta_data->>'guardian_email','');
  v_policy     text := nullif(new.raw_user_meta_data->>'policy_version','');
  v_consent    boolean := coalesce((new.raw_user_meta_data->>'consent')::boolean, false);
begin
  if v_role is null then
    return new;
  end if;

  -- [0056] Anti-escalade : un self-signup ne peut PAS s'octroyer un rôle hors
  -- de ceux proposés par l'UI. owner (et tout futur rôle privilégié) → 'joueur'.
  if v_role not in ('joueur', 'preparateur', 'medical', 'coach') then
    v_role := 'joueur';
  end if;

  if v_role = 'joueur' and v_new_player and v_team is not null then
    -- Totem unique par club : si le souhait est pris, on en propose un libre.
    v_name := public.unique_totem(v_team, coalesce(nullif(v_name,''),'Joueur'));

    insert into public.players (team_id, owner_uid, name, initials, pos, grp, num, is_custom)
    values (v_team, new.id, v_name, v_initials, v_pos,
            v_grp::player_group, v_num, true)
    returning id into v_player_id;

    if v_policy is not null then
      insert into public.consents
        (player_id, team_id, minor, guardian_name, guardian_email,
         policy_version, consent_given, consented_by)
      values
        (v_player_id, v_team, true, v_g_name, v_g_email,
         v_policy, v_consent, new.id)
      on conflict (player_id) do nothing;
    end if;
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
