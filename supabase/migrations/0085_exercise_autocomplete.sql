-- 0085 — Autocomplétion, création auto d'exos perso, déduplication (PR3)
--
-- Active la RLS sur exercise_library (le catalogue global reste lisible par
-- tous ; les exercices perso d'un club ne sont visibles que de ce club), et
-- expose des RPC SECURITY DEFINER : recherche floue classée par usage,
-- création d'exercice perso anti-doublon, incrément du compteur d'usage.
-- Aucune écriture cliente directe (toutes les écritures passent par les RPC).

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : catalogue global (club_id null) + exercices perso du club
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.exercise_library enable row level security;
drop policy if exists exercise_library_read on public.exercise_library;
create policy exercise_library_read on public.exercise_library for select
  using (club_id is null or club_id = my_club());
-- Pas de policy d'écriture : insertions/màj uniquement via les RPC definer.

-- ─────────────────────────────────────────────────────────────────────────────
-- Recherche d'exercices (autocomplétion) : catalogue + perso du club,
-- classés par (préfixe exact, puis usage, puis similarité trigram).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.search_exercises(p_q text, p_limit integer default 20)
returns table (
  id uuid, name text, name_en text, category text, equipment text,
  target_muscle text, thumb_url text, gif_url text,
  is_custom boolean, is_calisthenics boolean, usage_count integer, sim real
)
language sql stable security definer set search_path = public as $$
  with q as (select public._norm_ex_name(p_q) as n)
  select e.id, e.name, e.name_en, e.category, e.equipment,
         e.target_muscle, e.thumb_url, e.gif_url,
         coalesce(e.is_custom,false), coalesce(e.is_calisthenics,false), e.usage_count,
         similarity(e.name_norm, (select n from q)) as sim
  from public.exercise_library e, q
  where (e.club_id is null or e.club_id = my_club())
    and q.n is not null and q.n <> ''
    and (
      e.name_norm like q.n || '%'
      or e.name_norm % q.n
      or exists (select 1 from public.exercise_aliases a
                 where a.exercise_id = e.id and (a.alias_norm like q.n || '%' or a.alias_norm % q.n))
    )
  order by (e.name_norm like q.n || '%') desc, e.usage_count desc, sim desc, e.name asc
  limit greatest(1, least(p_limit, 50))
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Création d'un exercice perso (staff) — anti-doublon : si un exercice de même
-- nom normalisé existe déjà (catalogue ou club), on renvoie le SIEN sans créer.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_custom_exercise(
  p_name text, p_category text default null, p_equipment text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_norm text := public._norm_ex_name(p_name);
  v_club uuid := my_club();
  v_id   uuid;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if v_club is null then raise exception 'no club'; end if;
  if v_norm is null then raise exception 'empty name'; end if;

  -- Doublon exact (perso du club prioritaire, sinon catalogue global).
  select id into v_id from public.exercise_library
   where name_norm = v_norm and (club_id = v_club or club_id is null)
   order by (club_id is not null) desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.exercise_library
    (name, category, body_part, muscle_group, equipment, no_equipment, is_custom, club_id, created_by, source)
  values
    (btrim(p_name), nullif(p_category,''), coalesce(nullif(p_category,''),'autre'),
     nullif(p_category,''), nullif(p_equipment,''),
     coalesce(p_equipment,'') in ('','aucun'), true, v_club, auth.uid(), 'club')
  returning id into v_id;
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Incrément du compteur d'usage (les plus utilisés remontent en autocomplétion)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.increment_exercise_usage(p_ids uuid[])
returns void
language sql security definer set search_path = public as $$
  update public.exercise_library
     set usage_count = usage_count + 1
   where id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

revoke execute on function public.search_exercises(text, integer) from public, anon;
revoke execute on function public.create_custom_exercise(text, text, text) from public, anon;
revoke execute on function public.increment_exercise_usage(uuid[]) from public, anon;
grant execute on function public.search_exercises(text, integer) to authenticated;
grant execute on function public.create_custom_exercise(text, text, text) to authenticated;
grant execute on function public.increment_exercise_usage(uuid[]) to authenticated;
