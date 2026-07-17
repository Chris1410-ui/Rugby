-- Souscriptions Web Push des JOUEURS (une par navigateur/appareil).
-- L'envoi se fait côté serveur (Edge Function, service role → bypass RLS) ;
-- le joueur ne gère QUE sa propre souscription via my_player_id().
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_player_idx on public.push_subscriptions(player_id);

alter table public.push_subscriptions enable row level security;

-- Le joueur gère uniquement SES souscriptions (rattachées à sa fiche).
drop policy if exists push_self on public.push_subscriptions;
create policy push_self on public.push_subscriptions
  for all
  using (player_id = my_player_id())
  with check (player_id = my_player_id());

-- Le staff (can_write) et l'owner peuvent lire les souscriptions de leur club
-- (diagnostic ; l'envoi réel passe par le service role).
drop policy if exists push_staff_read on public.push_subscriptions;
create policy push_staff_read on public.push_subscriptions
  for select
  using ((is_staff() and team_id = my_team()) or is_owner());
