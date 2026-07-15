-- ════════════════════════════════════════════════════════════════
-- 0016 — Historisation des tests physiques par campagne.
--
-- Le préparateur crée des « campagnes de tests » datées (Camp 1 – Juillet…).
-- Chaque valeur des 6 métriques historisées (Bronco, Yo-Yo, Squat 5RM, CMJ,
-- Bench 5RM, Hang Clean 2RM) est rattachée à une campagne → évolution entre
-- camps côté joueur.
--
-- Isolation par club identique aux tests existants + patron « crews » :
--   FK composites verrouillant test_results.team_id sur la campagne ET le
--   joueur → impossible de mélanger deux clubs.
-- Les colonnes plates players.{bronco,…} restent DORMANTES (non lues pour ces
-- 6 champs, non supprimées) ; un « Camp initial » recopie leurs valeurs pour
-- ne rien perdre.
-- ════════════════════════════════════════════════════════════════

create table test_campaigns (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  name       text not null,
  date       date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (id, team_id)                       -- cible FK composite
);
create index on test_campaigns(team_id, date);

create table test_results (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null,
  player_id      uuid not null,
  team_id        text not null,
  bronco         text,
  yoyo           numeric,
  squat_5rm      text,
  cmj_overall    numeric,
  bench_5rm      numeric,
  hang_clean_2rm numeric,
  updated_at     timestamptz default now(),
  unique (campaign_id, player_id),
  foreign key (campaign_id, team_id) references test_campaigns(id, team_id) on delete cascade,
  foreign key (player_id, team_id)   references players(id, team_id)        on delete cascade
);
create index on test_results(player_id);

-- ---------- RLS ----------
alter table test_campaigns enable row level security;
alter table test_results   enable row level security;

-- Campagnes : lues par tout le club, écrites par le staff du club.
create policy tc_read  on test_campaigns for select using (team_id = my_team());
create policy tc_staff on test_campaigns for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy tc_owner on test_campaigns for all using (is_owner()) with check (is_owner());

-- Résultats : lus par le joueur concerné OU le staff du club ; écrits par le staff.
create policy tr_read  on test_results for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team()));
create policy tr_staff on test_results for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy tr_owner on test_results for all using (is_owner()) with check (is_owner());

-- ---------- REALTIME ----------
alter publication supabase_realtime add table test_campaigns, test_results;

-- ---------- SEED « Camp initial » ----------
-- Pour chaque club ayant déjà des valeurs plates, on crée une campagne initiale
-- et on y recopie les valeurs existantes (aucune perte).
do $$
declare t record; cid uuid;
begin
  for t in
    select distinct team_id from players
    where bronco is not null or yoyo is not null or squat_5rm is not null
       or cmj_overall is not null or bench_5rm is not null or hang_clean_2rm is not null
  loop
    insert into test_campaigns (team_id, name, date)
      values (t.team_id, 'Camp initial', current_date)
      returning id into cid;
    insert into test_results (campaign_id, player_id, team_id, bronco, yoyo, squat_5rm, cmj_overall, bench_5rm, hang_clean_2rm)
      select cid, p.id, p.team_id, p.bronco, p.yoyo, p.squat_5rm, p.cmj_overall, p.bench_5rm, p.hang_clean_2rm
        from players p
       where p.team_id = t.team_id
         and (p.bronco is not null or p.yoyo is not null or p.squat_5rm is not null
              or p.cmj_overall is not null or p.bench_5rm is not null or p.hang_clean_2rm is not null);
  end loop;
end $$;
