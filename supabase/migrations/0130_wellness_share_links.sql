-- 0130 — Liens de consultation Wellness (sans compte), token HACHÉ, révocables.
-- Un staff/owner génère un lien ponctuel qu'il envoie lui-même (WhatsApp/SMS).
-- Le lien ouvre une page publique read-only servie par une Edge Function
-- (service role) qui ne renvoie QUE les données Wellness pseudonymisées du club
-- lié au token — jamais de session, jamais de nom civil, aucun autre écran.

create table if not exists public.wellness_share_links (
  id             uuid primary key default gen_random_uuid(),
  team_id        text not null references public.teams(id) on delete cascade,
  token_hash     text not null unique,          -- SHA-256 du token ; le token brut n'est jamais stocké
  label          text,
  expires_at     timestamptz not null,
  revoked        boolean not null default false,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  last_viewed_at timestamptz,
  view_count     integer not null default 0
);
create index if not exists idx_wsl_team on public.wellness_share_links(team_id);

create table if not exists public.wellness_share_views (
  id         bigserial primary key,
  link_id    uuid not null references public.wellness_share_links(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  user_agent text
);
create index if not exists idx_wsv_link on public.wellness_share_views(link_id);

alter table public.wellness_share_links enable row level security;
alter table public.wellness_share_views enable row level security;

-- Lecture : staff du club + owner. Jamais joueurs, jamais anon. (L'Edge Function
-- lit via service role, hors RLS.)
drop policy if exists wsl_select on public.wellness_share_links;
create policy wsl_select on public.wellness_share_links for select to authenticated
using ((public.is_staff() and team_id = public.my_team()) or public.is_owner());

drop policy if exists wsv_select on public.wellness_share_views;
create policy wsv_select on public.wellness_share_views for select to authenticated
using (exists (select 1 from public.wellness_share_links l
  where l.id = link_id and ((public.is_staff() and l.team_id = public.my_team()) or public.is_owner())));

-- Créer un lien (owner/staff écrivain). Token généré + haché CÔTÉ CLIENT ; on ne
-- reçoit que le hash (64 hex). TTL borné 24/48/72h (défaut 48).
create or replace function public.create_wellness_share_link(
  p_token_hash text, p_ttl_hours int, p_label text default null, p_team_id text default null
) returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_team text := case when public.is_owner() then coalesce(p_team_id, public.my_team()) else public.my_team() end;
  v_ttl  int  := case when p_ttl_hours in (24, 48, 72) then p_ttl_hours else 48 end;
begin
  if not (public.is_owner() or (public.is_staff() and public.can_write())) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_team is null then raise exception 'NO_TEAM'; end if;
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'BAD_TOKEN'; end if;
  return query
  insert into public.wellness_share_links (team_id, token_hash, label, expires_at)
  values (v_team, p_token_hash, nullif(trim(p_label), ''), now() + make_interval(hours => v_ttl))
  returning wellness_share_links.id, wellness_share_links.expires_at;
end $$;
revoke all on function public.create_wellness_share_link(text, int, text, text) from public, anon;
grant execute on function public.create_wellness_share_link(text, int, text, text) to authenticated;

-- Révoquer (owner/staff écrivain du club).
create or replace function public.revoke_wellness_share_link(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team text;
begin
  select team_id into v_team from public.wellness_share_links where id = p_id;
  if v_team is null then return; end if;
  if not (public.is_owner() or (public.is_staff() and public.can_write() and v_team = public.my_team())) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  update public.wellness_share_links set revoked = true where id = p_id;
end $$;
revoke all on function public.revoke_wellness_share_link(uuid) from public, anon;
grant execute on function public.revoke_wellness_share_link(uuid) to authenticated;
