-- 0080 — Fondations des agrégats par exercice (PR2)
--
-- Table dénormalisée `exercise_perf` alimentée par un trigger sur session_logs.
-- Objectif : disposer, par (séance, joueur, exercice), d'agrégats prêts à
-- l'emploi (top charge, volume, 1RM estimé, séries prescrites/réalisées,
-- adhérence) pour les vues joueur/staff (PR3/PR4), sans jamais toucher au
-- chemin d'écriture du logging set-par-set ni aux formules existantes.
--
-- Cloisonnement : chaque ligne porte team_id + club_id + line (avants/arrieres)
-- dénormalisés depuis la séance et le joueur, pour que l'agrégation par équipe
-- ou par ligne reste strictement bornée. Aucune donnée ne traverse les clubs.
--
-- Le trigger est SECURITY DEFINER : les clients n'ont AUCUNE policy d'écriture,
-- la table n'est remplie que par re-calcul déterministe à chaque écriture d'un
-- session_log. Les formules (Epley) reprennent exactement celles du client.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers déterministes (miroir de src/lib/hevy.js exKey + Epley e1RM)
-- ─────────────────────────────────────────────────────────────────────────────

-- Clé d'identité d'un mouvement à partir de son nom (les exercices de séance ne
-- portent qu'un id éphémère, pas d'uuid bibliothèque). Miroir exact de
-- exKey() côté JS : minuscules, [^a-z0-9] supprimés, 24 premiers caractères.
create or replace function public._ex_key(p_name text)
returns text language sql immutable
set search_path = pg_catalog as $$
  select left(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '', 'g'), 24)
$$;

-- Extrait la valeur numérique de tête d'une saisie libre ("10 kg", "30 s",
-- "12 ", "10kg ", "") → numeric ou NULL. La virgule décimale est acceptée.
-- Note : substring(... from pattern) renvoie le PREMIER groupe capturant s'il
-- en existe un. On enveloppe donc tout le motif dans un unique groupe et on
-- rend le sous-motif décimal non-capturant (?:...), sinon le résultat est vide.
create or replace function public._num_lead(p_txt text)
returns numeric language sql immutable
set search_path = pg_catalog as $$
  select nullif(
    replace(coalesce(substring(coalesce(p_txt, '') from '([0-9]+(?:[.,][0-9]+)?)'), ''), ',', '.'),
    ''
  )::numeric
$$;

-- 1RM estimé (Epley), miroir exact de e1RM(w,reps) côté JS : round(w*(1+reps/30)).
create or replace function public._e1rm(p_w numeric, p_reps numeric)
returns integer language sql immutable as $$
  select case when coalesce(p_w, 0) > 0 and coalesce(p_reps, 0) > 0
              then round(p_w * (1 + p_reps / 30.0))::int
              else 0 end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table dénormalisée
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.exercise_perf (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  team_id       text not null,
  club_id       uuid,
  line          text,                 -- players.grp : 'avants' | 'arrieres'
  session_id    uuid not null references public.sessions(id) on delete cascade,
  date          date,
  exercise_key  text not null,        -- _ex_key(name)
  exercise_name text,
  top_kg        numeric,              -- charge max des séries de travail
  volume_kg     numeric,              -- somme w*reps des séries de travail
  est_1rm       integer,              -- meilleur Epley des séries de travail
  presc_sets    integer,              -- séries prescrites (séance)
  done_sets     integer,              -- séries réalisées (reps ou charge saisies)
  presc_pct     numeric,              -- % de 1RM prescrit (best-effort)
  adhered       boolean,              -- presc_sets NULL ou done_sets >= presc_sets
  created_at    timestamptz not null default now(),
  unique (session_id, player_id, exercise_key)
);

create index if not exists exercise_perf_team_key_idx   on public.exercise_perf (team_id, exercise_key);
create index if not exists exercise_perf_player_key_idx on public.exercise_perf (player_id, exercise_key, date);
create index if not exists exercise_perf_club_key_idx   on public.exercise_perf (club_id, exercise_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- Recalcul déterministe pour (séance, joueur)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public._rebuild_exercise_perf(p_session uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_per     jsonb;
  v_team    text;
  v_date    date;
  v_exos    jsonb;
  v_club    uuid;
  v_line    text;
begin
  -- On repart toujours d'une table propre pour ce couple.
  delete from public.exercise_perf where session_id = p_session and player_id = p_player;

  select sl.status::text, sl.per_exercise
    into v_status, v_per
    from public.session_logs sl
   where sl.session_id = p_session and sl.player_id = p_player
   limit 1;

  -- On n'agrège que les séances effectivement terminées.
  if v_status is distinct from 'done' or v_per is null then
    return;
  end if;

  select s.team_id, s.date, coalesce(s.exercises, '[]'::jsonb)
    into v_team, v_date, v_exos
    from public.sessions s
   where s.id = p_session;

  if v_team is null then
    return;
  end if;

  select t.club_id into v_club from public.teams t where t.id = v_team;
  select p.grp::text into v_line from public.players p where p.id = p_player;

  insert into public.exercise_perf (
    player_id, team_id, club_id, line, session_id, date,
    exercise_key, exercise_name, top_kg, volume_kg, est_1rm,
    presc_sets, done_sets, presc_pct, adhered
  )
  select
    p_player,
    v_team,
    v_club,
    v_line,
    p_session,
    v_date,
    public._ex_key(ex.name),
    ex.name,
    agg.top_kg,
    agg.volume_kg,
    agg.est_1rm,
    ex.presc_sets,
    agg.done_sets,
    ex.presc_pct,
    (ex.presc_sets is null or agg.done_sets >= ex.presc_sets)
  from jsonb_each(v_per) pe(exo_id, exo_val)
  -- Rattachement au descriptif de la séance (nom, séries/% prescrits).
  cross join lateral (
    select
      coalesce(o->>'name', '') as name,
      public._num_lead(o->>'sets') as presc_sets,
      -- % de 1RM éventuellement écrit dans la cellule reps ou charge.
      public._num_lead(
        substring(coalesce(o->>'reps', '') || ' ' || coalesce(o->>'charge', '')
                  from '([0-9]+)\s*%')
      ) as presc_pct
    from jsonb_array_elements(v_exos) o
    where o->>'id' = pe.exo_id
    limit 1
  ) ex
  -- Agrégats sur les séries de travail (hors échauffement).
  cross join lateral (
    select
      max(w)                                   as top_kg,
      sum(case when w is not null and r is not null then w * r end) as volume_kg,
      max(public._e1rm(w, r))                  as est_1rm,
      count(*) filter (where w is not null or r is not null) as done_sets
    from (
      select public._num_lead(st->>'w') as w, public._num_lead(st->>'reps') as r
      from jsonb_array_elements(coalesce(exo_val->'sets', '[]'::jsonb)) st
      where coalesce(st->>'type', 'normal') <> 'warmup'
    ) sets
  ) agg
  -- On ne matérialise que les exercices réellement travaillés.
  where agg.done_sets > 0;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger sur session_logs (additif : ne modifie pas le chemin d'écriture)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public._trg_exercise_perf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.exercise_perf
     where session_id = old.session_id and player_id = old.player_id;
    return old;
  end if;
  perform public._rebuild_exercise_perf(new.session_id, new.player_id);
  return new;
end;
$$;

drop trigger if exists exercise_perf_sync on public.session_logs;
create trigger exercise_perf_sync
  after insert or update or delete on public.session_logs
  for each row execute function public._trg_exercise_perf();

-- Ces fonctions SECURITY DEFINER ne doivent jamais être appelables en RPC : le
-- trigger les exécute en tant que propriétaire indépendamment de ces droits.
revoke execute on function public._rebuild_exercise_perf(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._trg_exercise_perf() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : lecture staff de l'équipe + joueur propriétaire. Aucune écriture client.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.exercise_perf enable row level security;

drop policy if exists exercise_perf_read on public.exercise_perf;
create policy exercise_perf_read on public.exercise_perf
  for select
  using (
    (is_staff() and team_id = my_team())
    or player_id = my_player_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill des logs existants
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare r record;
begin
  for r in select distinct session_id, player_id from public.session_logs loop
    perform public._rebuild_exercise_perf(r.session_id, r.player_id);
  end loop;
end $$;
