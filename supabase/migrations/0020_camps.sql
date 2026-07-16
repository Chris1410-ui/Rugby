-- ════════════════════════════════════════════════════════════════
-- 0020 — Camps : périodes nommées (dates début/fin) regroupant séances,
--        campagnes de tests et inscriptions.
--
-- Un camp NE duplique rien : il regroupe l'existant par des clés.
--   • Séances « du camp »  = séances dont la date ∈ [date_debut, date_fin]
--     (dérivé — aucune FK camp↔séance à maintenir).
--   • Résultats du camp    = campagnes de tests rattachées (test_campaigns.camp_id)
--     → réutilise test_results (report fiche + Top 14 + points déjà branchés).
--     Baseline début vs fin = deux campagnes rattachées au même camp.
--   • Inscriptions          = table camp_participants (inscrit / présent).
--
-- Inscription libre aux séances : nouveau mode `assigned.mode = 'open'`
-- (jsonb, aucune colonne à ajouter). Le joueur s'auto-inscrit via la fonction
-- SECURITY DEFINER enroll_in_session (il n'a AUCUN droit d'écriture direct sur
-- sessions) ; leave_session pour se retirer.
--
-- Isolation par club : patron « crews » — FK composites verrouillant team_id
-- sur le parent (camps) ET le joueur, + RLS re-vérifiant team_id = my_team().
-- ════════════════════════════════════════════════════════════════

-- ---------- CAMPS ----------
create table camps (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  nom        text not null,                     -- « Camp été »
  date_debut date not null,
  date_fin   date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (id, team_id)                          -- cible des FK composites
);
create index on camps(team_id, date_debut);

-- ---------- CAMP PARTICIPANTS ----------
create table camp_participants (
  camp_id    uuid not null,
  player_id  uuid not null,
  team_id    text not null,                     -- club — doit coller au camp ET au joueur
  statut     text not null default 'inscrit' check (statut in ('inscrit','present')),
  created_at timestamptz default now(),
  primary key (camp_id, player_id),
  -- ANTI-MÉLANGE DE CLUBS (contrainte dure) :
  foreign key (camp_id, team_id)   references camps(id, team_id)     on delete cascade,
  foreign key (player_id, team_id) references players(id, team_id)   on delete cascade
);
create index on camp_participants(player_id);

-- ---------- RÉSULTATS DATÉS PAR CAMP (réutilise test_campaigns/test_results) ----------
alter table test_campaigns add column camp_id uuid;
alter table test_campaigns
  add constraint tc_camp_fk
  foreign key (camp_id, team_id) references camps(id, team_id) on delete set null;
create index on test_campaigns(camp_id);

alter table test_results add column if not exists mas numeric;   -- MAS (colonne du tableur camp)

-- ---------- RLS ----------
alter table camps             enable row level security;
alter table camp_participants enable row level security;

-- Helper SECURITY DEFINER (bypass RLS → pas de récursion : ne lit que la ligne ciblée).
create or replace function public.camp_team(cid uuid) returns text
  language sql stable security definer set search_path = public, auth as
  $$ select team_id from public.camps where id = cid $$;

-- ── camps ── lus par tout le club (les joueurs doivent voir les camps pour s'y
-- inscrire), écrits par le staff du club ; owner voit tout.
create policy camps_read  on camps for select using (team_id = my_team());
create policy camps_staff on camps for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy camps_owner on camps for all using (is_owner()) with check (is_owner());

-- ── camp_participants ──
-- Lecture : le joueur concerné OU le staff du club.
create policy cp_read on camp_participants for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team()));
-- Auto-inscription : le joueur ajoute SA propre ligne, statut 'inscrit', dans son club.
create policy cp_player_enroll on camp_participants for insert
  with check (
    player_id = my_player_id()
    and team_id = my_team()
    and camp_team(camp_id) = my_team()
    and statut = 'inscrit'
  );
-- Se désinscrire : le joueur retire SA propre ligne.
create policy cp_player_leave on camp_participants for delete
  using (player_id = my_player_id());
-- Staff : tout (dont marquer « présent »).
create policy cp_staff on camp_participants for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
-- Owner : accès complet.
create policy cp_owner on camp_participants for all using (is_owner()) with check (is_owner());

-- ---------- INSCRIPTION LIBRE AUX SÉANCES (mode `open`) ----------
-- Le joueur n'a aucun droit d'écriture sur `sessions` (RLS staff/owner). Ces
-- fonctions SECURITY DEFINER sont le SEUL chemin d'auto-(dés)inscription : elles
-- vérifient le club + le mode 'open' puis (dé)ajoutent le player_id dans
-- assigned.ids (dédupliqué). assigned devient alors { mode:'open', ids:[…] }.
create or replace function public.enroll_in_session(p_session uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_pid  uuid := public.my_player_id();
  v_team text := public.my_team();
  v_sess public.sessions%rowtype;
begin
  if v_pid is null then raise exception 'not a player'; end if;
  select * into v_sess from public.sessions where id = p_session;
  if not found or v_sess.team_id <> v_team then raise exception 'session not found in your club'; end if;
  if coalesce(v_sess.assigned->>'mode','') <> 'open' then raise exception 'session not open for enrolment'; end if;
  update public.sessions s
     set assigned = jsonb_set(
           coalesce(s.assigned, '{}'::jsonb), '{ids}',
           (select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
              from jsonb_array_elements_text(
                     coalesce(s.assigned->'ids', '[]'::jsonb) || to_jsonb(array[v_pid::text])) as e)
         )
   where s.id = p_session;
end $$;

create or replace function public.leave_session(p_session uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_pid  uuid := public.my_player_id();
  v_team text := public.my_team();
  v_sess public.sessions%rowtype;
begin
  if v_pid is null then raise exception 'not a player'; end if;
  select * into v_sess from public.sessions where id = p_session;
  if not found or v_sess.team_id <> v_team then raise exception 'session not found in your club'; end if;
  update public.sessions s
     set assigned = jsonb_set(
           coalesce(s.assigned, '{}'::jsonb), '{ids}',
           (select coalesce(jsonb_agg(e), '[]'::jsonb)
              from jsonb_array_elements_text(coalesce(s.assigned->'ids', '[]'::jsonb)) as e
             where e <> v_pid::text)
         )
   where s.id = p_session;
end $$;

grant execute on function public.enroll_in_session(uuid) to authenticated;
grant execute on function public.leave_session(uuid)   to authenticated;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table camps, camp_participants;
