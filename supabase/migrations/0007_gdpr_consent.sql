-- ════════════════════════════════════════════════════════════════
-- 0007 — RGPD : consentement parental.
--
-- Les joueurs de l'équipe sont mineurs (U18) : le traitement de leurs
-- données de santé exige le consentement du représentant légal. On le
-- recueille à l'inscription et on l'archive (identité du responsable,
-- version de la politique acceptée, horodatage).
--
-- Droit à l'effacement / portabilité : traités hors schéma (Edge Function
-- `gdpr-erase` + export client via RLS).
-- ════════════════════════════════════════════════════════════════

create table if not exists consents (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null unique references players(id) on delete cascade,
  team_id        text not null references teams(id) on delete cascade,
  minor          boolean not null default true,
  guardian_name  text,
  guardian_email text,
  policy_version text not null,
  consent_given  boolean not null default false,
  consented_by   uuid references auth.users(id),
  consented_at   timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists consents_team_idx on consents(team_id);

alter table consents enable row level security;

-- Lecture : le joueur voit son consentement ; le staff, ceux de son équipe.
create policy consents_self_read on consents for select
  using (player_id = my_player_id());
create policy consents_staff_read on consents for select
  using (is_staff() and team_id = my_team());

-- Écriture (mise à jour / renouvellement / retrait) : le staff de l'équipe,
-- ou le titulaire du compte joueur lié. La création initiale passe par le
-- trigger d'inscription (SECURITY DEFINER, contourne la RLS).
create policy consents_staff_write on consents for all
  using (is_staff() and team_id = my_team())
  with check (is_staff() and team_id = my_team());
create policy consents_self_write on consents for all
  using (player_id = my_player_id())
  with check (player_id = my_player_id());

-- ── Extension du trigger d'inscription : archive le consentement parental ──
-- (métadonnées options.data : guardian_name, guardian_email, policy_version,
--  consent). Le reste de la fonction est inchangé.
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
  v_g_name     text := nullif(new.raw_user_meta_data->>'guardian_name','');
  v_g_email    text := nullif(new.raw_user_meta_data->>'guardian_email','');
  v_policy     text := nullif(new.raw_user_meta_data->>'policy_version','');
  v_consent    boolean := coalesce((new.raw_user_meta_data->>'consent')::boolean, false);
begin
  if v_role is null then
    return new;  -- profil géré ailleurs
  end if;

  if v_role = 'joueur' and v_new_player and v_team is not null then
    insert into public.players (team_id, owner_uid, name, pos, grp, num, is_custom)
    values (v_team, new.id, coalesce(nullif(v_name,''),'Joueur'), v_pos,
            v_grp::player_group, v_num, true)
    returning id into v_player_id;

    -- Consentement parental (données de santé d'un mineur)
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

revoke execute on function public.handle_new_user() from anon, authenticated, public;
