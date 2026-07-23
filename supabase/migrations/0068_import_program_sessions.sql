-- ════════════════════════════════════════════════════════════════
-- 0068 — Import d'un programme (depuis un PDF) par le JOUEUR pour lui-même.
--
-- Après l'aperçu + validation manuelle côté client (parse PDF faillible), le
-- joueur matérialise des séances DATÉES assignées à lui seul → elles s'affichent
-- dans son calendrier / « Aujourd'hui » et se logguent comme n'importe quelle
-- séance (points/compliance inchangés). Le joueur n'écrit jamais sur `sessions`
-- en direct : passage par cette fonction SECURITY DEFINER (comme les séances
-- libres, 0054). Chaque ligne = { date, code, nature, titre, exercises }.
-- Renvoie le nombre de séances créées. Garde-fous : joueur uniquement, borne à
-- 200 lignes, dates valides.
-- ════════════════════════════════════════════════════════════════

create or replace function public.import_program_sessions(p_rows jsonb)
  returns int
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_team text := public.my_team();
  v_pid  uuid := public.my_player_id();
  v_row  jsonb;
  v_n    int := 0;
begin
  if v_pid is null then
    raise exception 'IMPORT_PLAYER_ONLY';       -- staff/owner : pas de player_id
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'IMPORT_BAD_INPUT';
  end if;
  if jsonb_array_length(p_rows) > 200 then
    raise exception 'IMPORT_TOO_MANY';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if (v_row->>'date') is null then continue; end if;
    insert into public.sessions (team_id, date, code, nature, titre, duration_min, exercises, assigned, origin, created_by)
    values (
      v_team,
      (v_row->>'date')::date,
      coalesce(nullif(v_row->>'code', ''), 'RS'),
      nullif(v_row->>'nature', ''),
      coalesce(nullif(v_row->>'titre', ''), 'Séance importée'),
      60,
      coalesce(v_row->'exercises', '[]'::jsonb),
      jsonb_build_object('mode', 'players', 'ids', jsonb_build_array(v_pid::text)),
      'import',
      auth.uid()
    );
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

revoke all on function public.import_program_sessions(jsonb) from public;
grant execute on function public.import_program_sessions(jsonb) to authenticated;
