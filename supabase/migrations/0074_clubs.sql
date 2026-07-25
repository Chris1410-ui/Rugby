-- 0074 — CLUBS : entité PARENTE d'une ou plusieurs équipes.
-- Cible commerciale : un club (~160 joueurs) regroupe U16 + U18 + senior qui
-- partagent le même catalogue de sections-types et les mêmes crédits de
-- connaissance. On rattache chaque équipe à un club (teams.club_id) et on ancre
-- le catalogue au CLUB, pas à l'équipe.
--
-- Rétro-compat : backfill « 1 club = 1 équipe » pour tout l'existant, afin que
-- rien ne change de comportement tant que le multi-équipes n'est pas exploité.

create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.clubs enable row level security;

alter table public.teams add column if not exists club_id uuid references public.clubs(id);

-- Backfill : un club par équipe encore non rattachée (nom = label, repli id).
do $$
declare tr record; cid uuid;
begin
  for tr in select id, label from public.teams where club_id is null loop
    insert into public.clubs (name) values (coalesce(nullif(tr.label, ''), tr.id)) returning id into cid;
    update public.teams set club_id = cid where id = tr.id;
  end loop;
end $$;

-- club_id de l'appelant (via son équipe courante). SECURITY DEFINER : lecture
-- interne fiable pour les policies, sans exposer teams.
create or replace function public.my_club() returns uuid
  language sql stable security definer set search_path = public, auth as $$
  select t.club_id from public.teams t where t.id = public.my_team()
$$;

-- Lecture : un membre voit son propre club. Écriture : owner uniquement (MVP).
drop policy if exists clubs_read on public.clubs;
create policy clubs_read on public.clubs for select using (id = public.my_club() or public.is_owner());
drop policy if exists clubs_owner on public.clubs;
create policy clubs_owner on public.clubs for all using (public.is_owner()) with check (public.is_owner());

create index if not exists teams_club_idx on public.teams (club_id);
