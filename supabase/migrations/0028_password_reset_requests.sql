-- ════════════════════════════════════════════════════════════════
-- 0028 — Demandes de réinitialisation de mot de passe (joueur → staff).
--
-- Un joueur qui a oublié son mot de passe le demande depuis l'écran de
-- connexion (NON authentifié). La demande est enregistrée par l'Edge Function
-- request-password-reset (service role) et remonte au staff/owner du club, qui
-- réinitialise ensuite depuis la fiche joueur (Edge Function admin-reset-password).
-- ════════════════════════════════════════════════════════════════

create table password_reset_requests (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  player_id  uuid references players(id) on delete set null,
  email      text not null,
  name       text,               -- totem (snapshot) pour l'affichage staff
  note       text,               -- message optionnel du joueur
  status     text not null default 'pending',   -- pending | done
  created_at timestamptz default now(),
  handled_at timestamptz,
  handled_by uuid
);
create index on password_reset_requests(team_id, status);

alter table password_reset_requests enable row level security;
-- Lecture / traitement : staff du club + owner. Aucune policy pour anon/joueur →
-- l'insertion passe exclusivement par l'Edge Function (service role).
create policy prr_staff on password_reset_requests for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy prr_owner on password_reset_requests for all
  using (is_owner()) with check (is_owner());

alter publication supabase_realtime add table password_reset_requests;

-- Résolution email → joueur (SECURITY DEFINER). Appelée uniquement par l'Edge
-- Function (service role) : révoquée pour anon/authenticated afin d'éviter toute
-- énumération d'emails.
create or replace function public.find_reset_target(p_email text)
returns table(team_id text, player_id uuid, name text)
language sql
security definer
set search_path = public, auth
as $$
  select pr.team_id, pr.player_id, pl.name
  from auth.users u
  join public.profiles pr on pr.id = u.id
  left join public.players pl on pl.id = pr.player_id
  where lower(u.email) = lower(p_email) and pr.role = 'joueur'
  limit 1
$$;
revoke all on function public.find_reset_target(text) from public;
revoke all on function public.find_reset_target(text) from anon;
revoke all on function public.find_reset_target(text) from authenticated;
