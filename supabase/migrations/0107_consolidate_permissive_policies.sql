-- 0107 — Perf : consolidation des policies PERMISSIVES multiples (advisor
-- multiple_permissive_policies, ~598 combos role×action). Plusieurs policies
-- permissives pour un même (rôle, action) sont ÉVALUÉES CHACUNE par ligne. Comme
-- les policies permissives se combinent en OU, on les fusionne SANS changer l'accès :
-- une seule policy par action, dont la condition = OU des conditions d'origine.
-- Transformation prouvablement équivalente (OU des mêmes prédicats).
--
-- Bloc 1 : tables dont TOUTES les policies permissives partagent les mêmes rôles →
-- fusion automatique, rôles PRÉSERVÉS (anon reste bloqué par les mêmes conditions).
-- Blocs 2-4 : tables à rôles MIXTES traitées explicitement (semantique préservée).

-- ── Bloc 1 : fusion générique (rôles identiques) ────────────────────────────
do $$
declare
  t text; rls_roles text;
  sel text; del_u text; upd_u text; upd_c text; ins_c text;
  p record;
begin
  for t in (
    select tablename from pg_policies
    where schemaname = 'public' and permissive = 'PERMISSIVE'
    group by tablename
    having count(*) > 1 and count(distinct roles::text) = 1
  ) loop
    select array_to_string(roles, ',') into rls_roles
      from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE' limit 1;

    -- USING (lecture) : OU des quals des policies couvrant l'action.
    select string_agg(format('(%s)', qual), ' OR ') into sel
      from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE' and cmd in ('ALL','SELECT') and qual is not null;
    select string_agg(format('(%s)', qual), ' OR ') into del_u
      from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE' and cmd in ('ALL','DELETE') and qual is not null;
    select string_agg(format('(%s)', qual), ' OR ') into upd_u
      from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE' and cmd in ('ALL','UPDATE') and qual is not null;
    -- WITH CHECK (écriture) : un ALL sans WITH CHECK utilise sa clause USING → coalesce.
    select string_agg(format('(%s)', coalesce(with_check, qual)), ' OR ') into upd_c
      from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE' and cmd in ('ALL','UPDATE') and coalesce(with_check, qual) is not null;
    select string_agg(format('(%s)', coalesce(with_check, qual)), ' OR ') into ins_c
      from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE' and cmd in ('ALL','INSERT') and coalesce(with_check, qual) is not null;

    for p in (select policyname from pg_policies where schemaname='public' and tablename=t and permissive='PERMISSIVE') loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    if sel   is not null then execute format('create policy %I on public.%I for select to %s using (%s)', t||'_sel', t, rls_roles, sel); end if;
    if ins_c is not null then execute format('create policy %I on public.%I for insert to %s with check (%s)', t||'_ins', t, rls_roles, ins_c); end if;
    if upd_u is not null then execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)', t||'_upd', t, rls_roles, upd_u, coalesce(upd_c, upd_u)); end if;
    if del_u is not null then execute format('create policy %I on public.%I for delete to %s using (%s)', t||'_del', t, rls_roles, del_u); end if;
  end loop;
end $$;

-- ── Bloc 2 : program_docs (lecture public + écriture authenticated ; toutes les
-- conditions sont fausses pour anon → on consolide en `authenticated`). ────────
drop policy if exists progdocs_read on public.program_docs;
drop policy if exists progdocs_write on public.program_docs;
create policy progdocs_sel on public.program_docs for select to authenticated using (
  is_owner()
  or ((team_id = my_team()) and ((status = 'published') or is_staff()))
  or (exists (select 1 from sessions s where s.program_doc_id = program_docs.id and s.team_id = my_team()))
  or (can_write() and team_id = my_team())
);
create policy progdocs_ins on public.program_docs for insert to authenticated with check (is_owner() or (can_write() and team_id = my_team()));
create policy progdocs_upd on public.program_docs for update to authenticated using (is_owner() or (can_write() and team_id = my_team())) with check (is_owner() or (can_write() and team_id = my_team()));
create policy progdocs_del on public.program_docs for delete to authenticated using (is_owner() or (can_write() and team_id = my_team()));

-- ── Bloc 3 : routines (owner/self/staff, tout en ALL ; conditions fausses pour
-- anon → consolidation en `authenticated`). ───────────────────────────────────
drop policy if exists routines_owner on public.routines;
drop policy if exists routines_self on public.routines;
drop policy if exists routines_staff on public.routines;
create policy routines_sel on public.routines for select to authenticated using (
  is_owner() or (player_id = my_player_id()) or (can_write() and team_id = my_team())
);
create policy routines_ins on public.routines for insert to authenticated with check (
  is_owner() or ((player_id = my_player_id()) and (team_id = my_team())) or (can_write() and team_id = my_team())
);
create policy routines_upd on public.routines for update to authenticated
  using (is_owner() or (player_id = my_player_id()) or (can_write() and team_id = my_team()))
  with check (is_owner() or ((player_id = my_player_id()) and (team_id = my_team())) or (can_write() and team_id = my_team()));
create policy routines_del on public.routines for delete to authenticated using (
  is_owner() or (player_id = my_player_id()) or (can_write() and team_id = my_team())
);

-- ── Bloc 4 : exercise_library (catalogue). La lecture ANON `club_id IS NULL`
-- (catalogue global) est PRÉSERVÉE via une policy dédiée `to anon` ; la lecture
-- authenticated fusionne les trois conditions. Policies par rôle → aucun
-- (rôle, action) n'a plus 2 policies. ─────────────────────────────────────────
drop policy if exists exercise_library_read on public.exercise_library;
drop policy if exists exlib_read on public.exercise_library;
drop policy if exists exlib_write on public.exercise_library;
create policy exlib_anon_sel on public.exercise_library for select to anon using (club_id is null or club_id = my_club());
create policy exlib_sel on public.exercise_library for select to authenticated using (
  (club_id is null or club_id = my_club())
  or (team_id is null or team_id = my_team() or is_owner())
  or (is_owner() or (can_write() and team_id = my_team()))
);
create policy exlib_ins on public.exercise_library for insert to authenticated with check (is_owner() or (can_write() and team_id = my_team()));
create policy exlib_upd on public.exercise_library for update to authenticated using (is_owner() or (can_write() and team_id = my_team())) with check (is_owner() or (can_write() and team_id = my_team()));
create policy exlib_del on public.exercise_library for delete to authenticated using (is_owner() or (can_write() and team_id = my_team()));
