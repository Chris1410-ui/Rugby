-- 0070 — Unicité STRICTE des totems par club : insensible à la casse ET aux
-- espaces (avant : index sur lower(name) seul → « Lynx » vs « Lynx » avec espace
-- superflu passaient). Durcit aussi les fonctions de résolution / vérification.

-- 1) Dé-doublonnage sous la nouvelle normalisation lower(btrim(name)). Garde le
--    plus ancien de chaque groupe, renomme les suivants via unique_totem.
do $$
declare r record;
begin
  for r in
    select id, team_id, name from (
      select id, team_id, name,
        row_number() over (partition by team_id, lower(btrim(name)) order by created_at, id) as rn
      from public.players
    ) s where rn > 1
  loop
    update public.players set name = public.unique_totem(r.team_id, r.name) where id = r.id;
  end loop;
end $$;

-- 2) Index d'unicité insensible casse + espaces.
drop index if exists public.players_team_name_uq;
create unique index players_team_name_uq on public.players (team_id, lower(btrim(name)));

-- 3) unique_totem : comparaisons lower(btrim(name)) partout + fallback numéroté
--    garanti unique (boucle jusqu'à un candidat libre).
create or replace function public.unique_totem(p_team text, p_wanted text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pool text[] := array[
    'Minotaure','Renard futé','Sanglier','Aigle royal','Bison','Panthère',
    'Faucon','Loup gris','Taureau','Lynx','Rhinocéros','Cobra','Grizzly',
    'Guépard','Bélier','Corbeau','Requin','Tigre','Élan','Blaireau','Buffle',
    'Jaguar','Léopard','Puma','Gorille','Hyène','Ours brun','Étalon','Mustang',
    'Condor','Vautour','Scorpion','Python','Caïman','Orque','Griffon','Sphinx',
    'Wapiti','Carcajou','Serval','Ocelot','Fennec','Chacal','Dingo','Bouquetin',
    'Mouflon','Yak','Léviathan','Aigle noir','Morse'
  ];
  v_wanted text := btrim(coalesce(p_wanted, ''));
  t    text;
  cand text;
  i    int := 2;
begin
  -- (a) le totem souhaité est-il libre dans ce club ?
  if v_wanted <> ''
     and not exists (select 1 from public.players where team_id = p_team and lower(btrim(name)) = lower(v_wanted))
  then
    return v_wanted;
  end if;
  -- (b) sinon, premier totem inutilisé de la banque.
  foreach t in array pool loop
    if not exists (select 1 from public.players where team_id = p_team and lower(btrim(name)) = lower(t)) then
      return t;
    end if;
  end loop;
  -- (c) banque épuisée → suffixe numéroté sur le souhait (ou « Joueur »).
  loop
    cand := coalesce(nullif(v_wanted, ''), 'Joueur') || ' ' || i;
    exit when not exists (select 1 from public.players where team_id = p_team and lower(btrim(name)) = lower(cand));
    i := i + 1;
  end loop;
  return cand;
end;
$$;

-- 4) precheck_membership : disponibilité du totem insensible casse + espaces
--    (même signature/type de retour jsonb ; code club inchangé).
create or replace function public.precheck_membership(p_club_id text, p_code text, p_totem text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code_ok', exists (
      select 1 from public.teams
      where id = p_club_id and join_code is not null
        and upper(join_code) = upper(trim(coalesce(p_code, '')))
    ),
    'totem_free', not exists (
      select 1 from public.players
      where team_id = p_club_id and lower(btrim(name)) = lower(btrim(coalesce(p_totem, '')))
    )
  );
$$;

-- 5) request_club_membership : refus propre du totem déjà pris (insensible casse
--    + espaces). Corps identique à 0061, seule la vérif du totem est durcie.
create or replace function public.request_club_membership(
  p_club_id        text,
  p_code           text,
  p_totem          text,
  p_initials       text default null,
  p_birthdate      date default null,
  p_guardian_name  text default null,
  p_guardian_email text default null,
  p_policy_version text default null,
  p_consent        boolean default false
) returns text
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_minor boolean;
  v_totem text := btrim(coalesce(p_totem, ''));
  v_pid   uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  if exists (select 1 from public.profiles where id = v_uid and team_id is not null)
     or exists (select 1 from public.players where owner_uid = v_uid) then
    raise exception 'ALREADY_MEMBER';
  end if;

  select join_code into v_code from public.teams where id = p_club_id;
  if v_code is null or upper(trim(coalesce(p_code, ''))) <> upper(v_code) then
    raise exception 'BAD_CODE';
  end if;

  if v_totem = '' then raise exception 'TOTEM_REQUIRED'; end if;
  if exists (select 1 from public.players where team_id = p_club_id and lower(btrim(name)) = lower(v_totem)) then
    raise exception 'TOTEM_TAKEN';
  end if;

  v_minor := (p_birthdate is null) or (p_birthdate > (now() - interval '18 years')::date);
  if v_minor and (p_consent is not true
                  or coalesce(trim(p_guardian_name), '')  = ''
                  or coalesce(trim(p_guardian_email), '') = '') then
    raise exception 'CONSENT_REQUIRED';
  end if;

  insert into public.players (team_id, owner_uid, name, initials, is_custom, membership_status, membership_requested_at)
    values (p_club_id, v_uid, v_totem, nullif(trim(coalesce(p_initials, '')), ''), true, 'pending', now())
    returning id into v_pid;

  insert into public.profiles (id, role, player_id, team_id)
    values (v_uid, 'joueur', v_pid, null)
    on conflict (id) do update set role = 'joueur', player_id = excluded.player_id, team_id = null;

  if v_minor and p_policy_version is not null then
    insert into public.consents (player_id, team_id, minor, guardian_name, guardian_email, policy_version, consent_given, consented_by)
      values (v_pid, p_club_id, true, p_guardian_name, p_guardian_email, p_policy_version, p_consent, v_uid)
      on conflict (player_id) do nothing;
  end if;

  return v_pid::text;
end $$;
