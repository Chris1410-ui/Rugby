-- ════════════════════════════════════════════════════════════════
-- 0038 — Initiales joueur + langue du profil.
--
-- 1) players.initials : les initiales saisies par le joueur (ex. « I.F. »).
--    Affichées partout sous la forme « Totem (I.F.) ». Le joueur les saisit à
--    l'inscription et peut les modifier depuis sa fiche. L'import peut aussi les
--    renseigner. Le nom complet n'est JAMAIS stocké pour l'affichage (il vit
--    uniquement dans le fichier Excel du staff, hors application).
-- 2) profiles.locale : langue d'interface préférée (fr/en/nl), pour suivre
--    l'utilisateur d'un appareil à l'autre (l'i18n lit/écrit cette valeur).
-- 3) handle_new_user : persiste `initials` fourni à l'inscription.
-- ════════════════════════════════════════════════════════════════

alter table public.players  add column if not exists initials text;
alter table public.profiles add column if not exists locale text;

-- Inscription joueur : reprend le totem unique (inchangé) + les initiales saisies.
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

-- 4) Le joueur modifie SES initiales (et rien d'autre). RLS players n'accorde
--    aucun UPDATE au joueur sur sa ligne (il pourrait sinon changer totem/poste) ;
--    on passe donc par une RPC SECURITY DEFINER qui ne touche QUE `initials`.
create or replace function public.set_my_initials(p_initials text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.players
    set initials = nullif(btrim(p_initials), '')
    where id = public.my_player_id();
end;
$$;
grant execute on function public.set_my_initials(text) to authenticated;
