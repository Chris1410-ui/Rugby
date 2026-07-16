-- ════════════════════════════════════════════════════════════════
-- 0027 — Totems uniques par club.
--
-- 1) unique_totem(team, wanted) : renvoie un totem LIBRE pour l'équipe —
--    le totem souhaité s'il est disponible, sinon un totem inutilisé de la
--    banque (même style), sinon un suffixe numéroté (« Aigle royal 2 »).
-- 2) Dé-doublonnage des totems déjà en base (garde le plus ancien, renomme
--    les suivants avec un totem libre).
-- 3) Index d'unicité (insensible à la casse) du totem par club → empêche tout
--    doublon futur (création staff / inscription / démo).
-- 4) handle_new_user : à l'inscription d'un joueur, résout le totem via
--    unique_totem → jamais d'échec sur doublon (propose un alternatif).
-- ════════════════════════════════════════════════════════════════

-- 1) Banque de totems + résolution d'un totem libre par club.
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
  t    text;
  cand text;
  i    int := 2;
begin
  -- (a) le totem souhaité est-il libre dans ce club ?
  if p_wanted is not null and btrim(p_wanted) <> ''
     and not exists (select 1 from public.players where team_id = p_team and lower(name) = lower(btrim(p_wanted)))
  then
    return btrim(p_wanted);
  end if;
  -- (b) sinon, premier totem inutilisé de la banque.
  foreach t in array pool loop
    if not exists (select 1 from public.players where team_id = p_team and lower(name) = lower(t)) then
      return t;
    end if;
  end loop;
  -- (c) banque épuisée → suffixe numéroté sur le souhait (ou « Joueur »).
  loop
    cand := coalesce(nullif(btrim(p_wanted), ''), 'Joueur') || ' ' || i;
    exit when not exists (select 1 from public.players where team_id = p_team and lower(name) = lower(cand));
    i := i + 1;
  end loop;
  return cand;
end;
$$;

-- 2) Dé-doublonnage : garde le plus ancien de chaque totem, renomme les suivants.
do $$
declare r record;
begin
  for r in
    select id, team_id, name from (
      select id, team_id, name,
        row_number() over (partition by team_id, lower(name) order by created_at, id) as rn
      from public.players
    ) s where s.rn > 1
  loop
    update public.players set name = public.unique_totem(r.team_id, r.name) where id = r.id;
  end loop;
end $$;

-- 3) Unicité du totem par club (insensible à la casse).
create unique index if not exists players_team_name_uq on public.players (team_id, lower(name));

-- 4) Inscription joueur : résout le totem (propose un alternatif si déjà pris).
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
    return new;
  end if;

  if v_role = 'joueur' and v_new_player and v_team is not null then
    -- Totem unique par club : si le souhait est pris, on en propose un libre.
    v_name := public.unique_totem(v_team, coalesce(nullif(v_name,''),'Joueur'));

    insert into public.players (team_id, owner_uid, name, pos, grp, num, is_custom)
    values (v_team, new.id, v_name, v_pos,
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
