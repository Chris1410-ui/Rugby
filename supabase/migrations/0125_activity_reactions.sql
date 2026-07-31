-- ─────────────────────────────────────────────────────────────────────────────
-- Classement v2 · PR-3 — Encouragements entre coéquipiers (SOCIAL, aucun point).
--
-- Une réaction simple d'un joueur vers un coéquipier, plafonnée à 1/jour/paire.
-- AUCUN point échangé (pas de 2e monnaie, pas de collusion possible). Le
-- destinataire reçoit une petite notification (pastille + push via notify_push).
-- Portée club (RLS). Écriture par RPC SECURITY DEFINER (self-check + fan-out).
-- Pseudonymisation : la notification porte le TOTEM de l'émetteur (jamais le nom
-- civil), résolu côté base depuis players.name.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.activity_reactions (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null,
  from_player uuid not null references public.players(id) on delete cascade,
  to_player   uuid not null references public.players(id) on delete cascade,
  day         date not null default current_date,
  created_at  timestamptz not null default now()
);
-- 1 encouragement par jour et par paire (idempotence anti-spam).
create unique index if not exists activity_reactions_day_uk
  on public.activity_reactions(from_player, to_player, day);
create index if not exists activity_reactions_to_idx on public.activity_reactions(to_player);

alter table public.activity_reactions enable row level security;
drop policy if exists activity_reactions_select on public.activity_reactions;
create policy activity_reactions_select on public.activity_reactions for select to authenticated
using (team_id = my_team() or is_owner());
-- Aucune écriture directe : tout passe par la RPC (contrôle + notification).

create or replace function public.kudos_send(p_to uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me   uuid := my_player_id();
  v_team text := my_team();
  v_from text;
  v_ok   boolean;
begin
  if v_me is null then raise exception 'no_player'; end if;
  if p_to = v_me then raise exception 'self'; end if;
  -- Le destinataire doit être un coéquipier actif (même club).
  select true into v_ok from public.players
   where id = p_to and team_id = v_team
     and coalesce(membership_status,'active') <> 'rejected' and coalesce(is_demo,false) = false;
  if not coalesce(v_ok, false) then raise exception 'bad_target'; end if;

  insert into public.activity_reactions (team_id, from_player, to_player)
    values (v_team, v_me, p_to)
    on conflict (from_player, to_player, day) do nothing;
  if not found then return; end if; -- déjà encouragé aujourd'hui → pas de doublon de notif

  select name into v_from from public.players where id = v_me;
  insert into public.notifications (team_id, player_id, type, titre, body, ref_id, route)
    values (v_team, p_to, 'kudos', 'Encouragement 💪',
            coalesce(v_from, 'Un coéquipier') || ' t''a encouragé 💪', v_me, 'classement');
end $$;

revoke execute on function public.kudos_send(uuid) from public, anon;
grant execute on function public.kudos_send(uuid) to authenticated;