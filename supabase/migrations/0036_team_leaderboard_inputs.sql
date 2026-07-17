-- Classement identique pour TOUS (owner/staff/joueur). Les points sont calculés
-- client-side par computePoints à partir de session_logs + daily_checkins, mais
-- la RLS limite ces tables au joueur lui-même → un joueur calculait de faux
-- points pour ses coéquipiers. Ces 2 RPC SECURITY DEFINER exposent, à tout
-- membre du club, UNIQUEMENT le sous-ensemble « points » (statut de séance,
-- activités déclarées, bilan complété) — JAMAIS les valeurs de bien-être / RPE.

create or replace function public.team_session_logs(p_team text)
returns table (session_id uuid, player_id uuid, status text, filled boolean)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select l.session_id, l.player_id, l.status::text,
         coalesce((
           select bool_or((v->>'charge') is not null or (v->>'reps') is not null or (v->>'rpe') is not null)
           from jsonb_each(coalesce(l.per_exercise, '{}'::jsonb)) as e(k, v)
         ), false) as filled
  from public.session_logs l
  join public.players p on p.id = l.player_id
  where p.team_id = p_team
    and (p_team = my_team() or is_owner());
$function$;

create or replace function public.team_checkin_events(p_team text)
returns table (player_id uuid, checkin_date date, moment text, activities text[])
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select c.player_id, c.date, coalesce(c.moment, 'matin'), coalesce(c.activities, '{}'::text[])
  from public.daily_checkins c
  join public.players p on p.id = c.player_id
  where p.team_id = p_team
    and (p_team = my_team() or is_owner());
$function$;

revoke all on function public.team_session_logs(text) from public, anon;
revoke all on function public.team_checkin_events(text) from public, anon;
grant execute on function public.team_session_logs(text) to authenticated;
grant execute on function public.team_checkin_events(text) to authenticated;
