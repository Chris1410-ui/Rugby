-- Console owner : liste de TOUS les comptes, tous clubs (prépas, coachs,
-- médical, joueurs). L'email vient de auth.users → SECURITY DEFINER (seul moyen
-- propre) ; réservé STRICTEMENT à l'owner (garde is_owner() dans le corps).
create or replace function public.owner_list_accounts()
returns table (
  id uuid,
  email text,
  full_name text,
  role app_role,
  team_id text,
  team_label text,
  player_id uuid
)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select p.id, u.email::text, p.full_name, p.role, p.team_id, t.label, p.player_id
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.teams t on t.id = p.team_id
  where public.is_owner()             -- aucune ligne si l'appelant n'est pas owner
  order by t.label nulls last, p.role, p.full_name;
$function$;

revoke all on function public.owner_list_accounts() from public, anon;
grant execute on function public.owner_list_accounts() to authenticated;
